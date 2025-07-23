import {
	IBinaryData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class VocantAITrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vocant AI Callback',
		name: 'vocantAITrigger',
		icon: 'file:vocant.svg',
		group: ['trigger'],
		version: 1,
		description: 'Receives transcription results from Vocant AI',
		defaults: {
			name: 'Vocant AI Callback',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		credentials: [
			{
				name: 'vocantApi',
				required: true,
			},
		],
		properties: [],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headers = this.getHeaderData();
		const webhookData = req.body;

		const credentials = await this.getCredentials('vocantApi');
		const authToken = credentials.apiKey as string;

		if (authToken && headers['x-api-key'] !== authToken) {
			throw new Error('Unauthorized');
		}

		try {
			if (!webhookData || !webhookData.jobId) {
				throw new Error('Invalid webhook data: jobId');
			}

			const jobId = webhookData.jobId;

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

			return {
				workflowData: [
					[
						{
							json: {
								success: true,
								jobId,
								timestamp: new Date().toISOString(),
							},
							binary: {
								data: binaryResponse,
							},
						},
					],
				],
			};
		} catch (error) {
			return {
				workflowData: [
					[
						{
							json: {
								status: 'error',
								message: error.message,
								originalData: webhookData,
								timestamp: new Date().toISOString(),
							},
						},
					],
				],
			};
		}
	}
}
