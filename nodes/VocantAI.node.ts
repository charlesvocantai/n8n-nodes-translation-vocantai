import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class VocantAI implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vocant AI',
		name: 'VocantAI',
		icon: 'file:vocant.svg',
		group: ['transform'],
		version: 1,
		description: 'Upload and process audio file with Vocant AI',
		defaults: {
			name: 'Vocant AI',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'vocantApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Upload File',
						value: 'upload',
						description: 'Upload a file to Vocant AI',
						action: 'Upload a file to Vocant AI',
					},
					{
						name: 'Check Status',
						value: 'checkStatus',
						description: 'Check the status of a transcription job',
						action: 'Check the status of a transcription job',
					},
					{
						name: 'Get Transcription',
						value: 'getTranscription',
						description: 'Retrieve the transcription result of a job',
						action: 'Get the transcription result of a job',
					},
				],
				default: 'upload',
			},
			{
				displayName: 'Audio File (binary)',
				name: 'file',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: ['upload'],
					},
				},
				placeholder: 'e.g. data,data2,data3',
				hint: 'The name of the input binary field(s) containing the audio file to process',
			},
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://your-callback-url.com',
				hint: 'Enter the URL to which Vocant AI should send the results of the processing. Ideally, this should be the Vocant AI Trigger node webhook URL.',
				description:
					'Will return a JSON object with the results of the processing. The Vocant AI Trigger node can be used to receive these results and automatically grab the transcription file as binary output for additional workflow processing.',
				displayOptions: {
					show: {
						operation: ['upload'],
					},
				},
			},
			{
				displayName: 'Use Original Filename',
				name: 'useOriginalFilename',
				type: 'boolean',
				default: false,
				description: 'Whether to use the original filename as base name for the transcription file',
				displayOptions: {
					show: {
						operation: ['upload'],
					},
				},
			},
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				default: '',
				placeholder: 'e.g. your-jobId',
				hint: 'Enter the jobId of the transcription job to check the status or retrieve the result. This is returned by the Vocant AI Upload node.',
				required: true,
				displayOptions: {
					show: {
						operation: ['checkStatus', 'getTranscription'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('vocantApi');

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'upload') {
					const binaryPropertyName = this.getNodeParameter('file', i) as string;
					const callbackUrl = this.getNodeParameter('callbackUrl', i) as string;
					const useOriginalFilename = this.getNodeParameter('useOriginalFilename', i) as boolean;

					if (!items[i].binary?.[binaryPropertyName]) {
						throw new Error(`No binary data found for property "${binaryPropertyName}"`);
					}

					const binaryData = items[i].binary![binaryPropertyName];
					const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

					// Step 1: Get presigned URL using n8n's httpRequest
					const presignedOptions: IHttpRequestOptions = {
						method: 'POST',
						url: 'https://app.vocant.ai/api/webhook/presigned',
						headers: {
							'Content-Type': 'application/json',
							'X-API-KEY': credentials.apiKey as string,
						},
						body: {
							fileName: binaryData.fileName,
							fileSize: buffer.length,
							contentType: binaryData.mimeType,
							callbackUrl: callbackUrl || undefined,
							options: {
								useOriginalFilename: useOriginalFilename || false,
							},
						},
						json: true,
					};

					const presignedResponse = await this.helpers.httpRequest(presignedOptions);
					const { jobId, uploadUrl, fileUrl, expiresIn } = presignedResponse;

					// Step 2: Upload file using n8n's httpRequest
					const uploadOptions: IHttpRequestOptions = {
						method: 'PUT',
						url: uploadUrl,
						headers: {
							'Content-Type': binaryData.mimeType || 'audio/mpeg',
						},
						body: buffer,
					};

					await this.helpers.httpRequest(uploadOptions);

					returnData.push({
						json: {
							success: true,
							jobId,
							fileUrl,
							expiresIn,
							originalFileName: binaryData.fileName,
							fileSize: buffer.length,
							uploadTimestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				}

				if (operation === 'checkStatus') {
					const jobId = this.getNodeParameter('jobId', i) as string;

					const statusOptions: IHttpRequestOptions = {
						method: 'GET',
						url: `https://app.vocant.ai/api/webhook/status/${jobId}`,
						headers: {
							Accept: 'application/json',
							'x-api-key': credentials.apiKey as string,
						},
						json: true,
					};

					const response = await this.helpers.httpRequest(statusOptions);
					returnData.push({
						json: response,
						pairedItem: { item: i },
					});
				}

				if (operation === 'getTranscription') {
					const jobId = this.getNodeParameter('jobId', i) as string;

					const downloadOptions: IHttpRequestOptions = {
						method: 'GET',
						url: `https://app.vocant.ai/api/webhook/download/${jobId}`,
						headers: {
							'x-api-key': credentials.apiKey as string,
						},
						encoding: 'text',
					};

					const response = await this.helpers.httpRequest(downloadOptions);

					const binaryResponse: IBinaryData = {
						data: Buffer.from(response as string).toString('base64'),
						mimeType: 'text/plain',
						fileName: `transcription_${jobId}.txt`,
					};

					returnData.push({
						json: {
							success: true,
							jobId,
						},
						binary: {
							data: binaryResponse,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
