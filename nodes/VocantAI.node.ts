import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import axios, { AxiosError } from 'axios';
import { Buffer } from 'buffer';
import * as https from 'https';

export class VocantAI implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vocant AI',
		name: '',
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

		// Create a custom HTTPS agent with longer timeout
		const httpsAgent = new https.Agent({
			rejectUnauthorized: true,
			timeout: 30000, // 30 second timeout
			keepAlive: true,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'upload') {
					try {
						const binaryPropertyName = this.getNodeParameter('file', i) as string;

						if (!items[i].binary) {
							throw new Error('No binary data found');
						}
						const binary = items[i].binary as { [key: string]: IBinaryData };
						const binaryData = binary[binaryPropertyName];
						if (!binaryData) {
							throw new Error(`No binary data found for property "${binaryPropertyName}"`);
						}

						// Get callbackUrl parameter
						const callbackUrl = this.getNodeParameter('callbackUrl', i) as string;
						const useOriginalFilename = this.getNodeParameter('useOriginalFilename', i) as boolean;

						// Get binary data buffer directly
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const actualFileSize = buffer.length;

						const dataProps = {
							fileName: binaryData.fileName,
							fileSize: actualFileSize,
							contentType: binaryData.mimeType,
							callbackUrl: callbackUrl || undefined,
							options: {
								useOriginalFilename: useOriginalFilename || false,
							},
						};
						console.log('VAI Upload Presign Request Data Properties:', dataProps);

						// Step 1: Get presigned URL
						const presignedResponse = await axios({
							method: 'POST',
							url: 'https://app.vocant.ai/api/webhook/presigned',
							headers: {
								'Content-Type': 'application/json',
								'X-API-KEY': credentials.apiKey as string,
							},
							data: dataProps,
						});

						const { jobId, uploadUrl, fileUrl, expiresIn } = presignedResponse.data;

						// Step 2: Upload file using buffer directly
						await axios({
							method: 'PUT',
							url: uploadUrl,
							headers: {
								'Content-Type': binaryData.mimeType || 'audio/mpeg',
								'Content-Length': actualFileSize,
							},
							data: buffer,
							maxBodyLength: Infinity,
							maxContentLength: Infinity,
						});

						// Return success response
						returnData.push({
							json: {
								success: true,
								jobId,
								fileUrl,
								expiresIn,
								originalFileName: binaryData.fileName,
								fileSize: actualFileSize,
								uploadTimestamp: new Date().toISOString(),
							},
							pairedItem: { item: i },
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({
								json: {
									success: false,
									error: error.message,
									details: error.response?.data || {},
								},
								pairedItem: { item: i },
							});
							continue;
						}
						throw error;
					}
				}
				if (operation === 'checkStatus') {
					const jobId = this.getNodeParameter('jobId', i) as string;

					const requestOptions = {
						method: 'GET',
						url: `https://app.vocant.ai/api/webhook/status/${jobId}`,
						headers: {
							Accept: 'application/json',
							'x-api-key': credentials.apiKey as string,
						},
						httpsAgent,
						timeout: 30000, // 30 second timeout
						maxRetries: 3,
						retryDelay: 1000,
					};

					try {
						const response = await axios(requestOptions);
						returnData.push({
							json: response.data,
							pairedItem: { item: i },
						});
					} catch (error) {
						if (error instanceof AxiosError) {
							const errorMessage =
								error.code === 'ECONNRESET'
									? 'Connection reset by server. Please try again.'
									: error.message;

							throw new Error(
								`Status check failed: ${errorMessage}\nRequest URL: ${requestOptions.url}`,
							);
						}
						throw error;
					}
				}
				if (operation === 'getTranscription') {
					const jobId = this.getNodeParameter('jobId', i) as string;

					const credentials = await this.getCredentials('vocantApi');
					const response = await axios({
						method: 'GET',
						url: `https://app.vocant.ai/api/webhook/download/${jobId}`,
						headers: {
							'x-api-key': credentials.apiKey as string,
						},
					});
					// Convert response to binary data
					const binaryResponse: IBinaryData = {
						data: Buffer.from(response.data).toString('base64'),
						mimeType: 'text/plain',
						fileName: `response_${jobId}.txt`,
					};

					// Return both the JSON response and binary data
					returnData.push({
						json: {
							success: true,
							statusCode: response.status,
						},
						binary: {
							data: binaryResponse,
						},
						pairedItem: {
							item: i,
						},
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
