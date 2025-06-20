import {
	IBinaryData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import axios from 'axios';

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
		const returnData: INodeExecutionData[] = [];

		const req = this.getRequestObject();
		const headers = this.getHeaderData();
		const webhookData = req.body;

		// Optional authentication check
		const credentials = await this.getCredentials('vocantApi');
		const authToken = credentials.apiKey as string;
		if (authToken && headers['x-api-key'] !== authToken) {
			throw new Error('Unauthorized');
		}

		try {
			// Validate webhook data
			if (!webhookData || !webhookData.jobId) {
				throw new Error('Invalid webhook data: jobId');
			}

			const jobId = webhookData.jobId;
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
					item: 0,
				},
			});
		} catch (error) {
			// Handle errors
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
		return {
			workflowData: [returnData],
		};
	}
}
