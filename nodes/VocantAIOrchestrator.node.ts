import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class VocantAIOrchestrator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'VocantAI Speech-to-Text',
		name: 'vocantAIOrchestrator',
		icon: 'file:vocant.svg',
		group: ['transform'],
		version: 1,
		description: 'Upload and download transcription in one node',
		defaults: {
			name: 'VocantAI Speech-to-Text',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'vocantApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Audio File (binary)',
				name: 'file',
				type: 'string',
				default: 'data',
				required: true,
				hint: 'The name of the input binary field containing the audio file to process',
			},
			{
				displayName: 'Use Original Filename',
				name: 'useOriginalFilename',
				type: 'boolean',
				default: false,
				description: 'Whether to use the original filename for the transcription file',
			},
			{
				displayName: 'Polling Interval (seconds)',
				name: 'pollInterval',
				type: 'number',
				default: 5,
				description: 'How often to check job status',
			},
			{
				displayName: 'Max Wait Time (seconds)',
				name: 'maxWait',
				type: 'number',
				default: 900,
				description: 'Maximum time to wait for transcription',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('vocantApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const binaryPropertyName = this.getNodeParameter('file', i) as string;
				const useOriginalFilename = this.getNodeParameter('useOriginalFilename', i) as boolean;
				const pollInterval = this.getNodeParameter('pollInterval', i) as number;
				const maxWait = this.getNodeParameter('maxWait', i) as number;

				console.log(JSON.stringify(items[i], null, 2));

				if (!items[i].binary?.[binaryPropertyName]) {
					throw new Error(
						`No binary data found for property "${binaryPropertyName}": ${JSON.stringify(items[i], null, 2)}`,
					);
				}
				const binaryData = items[i].binary![binaryPropertyName];
				const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

				console.log('Item', i, 'binary:', items[i].binary);
				console.log('binaryPropertyName:', binaryPropertyName);

				// Step 1: Get presigned URL
				console.log('Requesting presigned URL...');
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
						options: {
							useOriginalFilename,
						},
					},
					json: true,
				};
				const presignedResponse = await this.helpers.httpRequest(presignedOptions);
				const { jobId, uploadUrl } = presignedResponse;
				console.log('Presigned response success for jobId:', jobId);

				// Step 2: Upload file using n8n's httpRequest
				console.log('Uploading file to presigned URL...');
				const uploadOptions: IHttpRequestOptions = {
					method: 'PUT',
					url: uploadUrl,
					headers: {
						'Content-Type': binaryData.mimeType || 'audio/mpeg',
					},
					body: buffer,
				};

				await this.helpers.httpRequest(uploadOptions);

				// Step 3: Poll for completion
				console.log('Check for transcription status...');
				let status = 'pending';
				let waited = 0;
				let transcriptionUrl = '';
				while (waited < maxWait) {
					await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));

					waited += pollInterval;

					const statusOptions: IHttpRequestOptions = {
						method: 'GET',
						url: `https://app.vocant.ai/api/webhook/status/${jobId}`,
						headers: {
							Accept: 'application/json',
							'x-api-key': credentials.apiKey as string,
						},
						json: true,
					};
					const statusResponse = await this.helpers.httpRequest(statusOptions);

					// Use 'state' instead of 'status'
					const state = statusResponse.state;
					console.log(`State for jobId ${jobId}: ${state}`);
					console.log('Full status response:', JSON.stringify(statusResponse, null, 2));

					if (state === 'completed' && statusResponse.downloadUrl) {
						transcriptionUrl = statusResponse.downloadUrl;
						break;
					}
					if (state === 'failed') {
						throw new Error(
							`Transcription failed: ${jobId}: ${statusResponse.message || 'Unknown error'}`,
						);
					}
				}
				if (!transcriptionUrl) {
					// Push to error output with jobId and error info
					returnData.push({
						json: {
							success: false,
							jobId,
							error: `Transcription jobId ${jobId} did not complete in time`,
							status,
							waited,
						},
						pairedItem: { item: i },
					});
					continue; // Don't throw, just continue to next item
				}

				// Step 4: Download transcription
				const downloadOptions: IHttpRequestOptions = {
					method: 'GET',
					url: transcriptionUrl,
					headers: {
						'x-api-key': credentials.apiKey as string,
					},
					encoding: 'text',
				};
				const response = await this.helpers.httpRequest(downloadOptions);

				const fileName =
					useOriginalFilename && binaryData.fileName
						? binaryData.fileName.replace(/\.[^/.]+$/, '') + '_transcription.txt'
						: `transcription_${jobId}.txt`;

				const binaryResponse: IBinaryData = {
					data: Buffer.from(response as string).toString('base64'),
					mimeType: 'text/plain',
					fileName,
				};

				returnData.push({
					json: {
						success: true,
						jobId,
						status,
						waited,
					},
					binary: {
						data: binaryResponse,
					},
					pairedItem: { item: i },
				});
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
