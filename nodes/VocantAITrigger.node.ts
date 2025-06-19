import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { Buffer } from 'buffer';

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
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'string',
				default: '',
				description: 'Optional webhook authentication token',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headers = this.getHeaderData();
		const body = req.body as Buffer;

		// Optional authentication check
		const credentials = await this.getCredentials('vocantApi');
		const authToken = credentials.apiKey as string;
		if (authToken && headers['x-api-key'] !== authToken) {
			throw new Error('Unauthorized');
		}

		// Process the incoming binary file
		if (!body) {
			return {
				workflowData: [
					[
						{
							json: {
								status: 'error',
								message: 'No file content received',
							},
						},
					],
				],
			};
		}

		// Get filename from headers or generate one
		const contentDisposition = headers['content-disposition'] || '';
		const filenameMatch = contentDisposition.match(/filename="(.+)"/);
		const filename = filenameMatch ? filenameMatch[1] : 'transcription.txt';

		// Return the binary data
		return {
			workflowData: [
				[
					{
						json: {
							headers,
							timestamp: new Date().toISOString(),
							filename,
						},
						binary: {
							data: {
								data: body.toString('base64'),
								mimeType: 'text/plain',
								fileName: filename,
							},
						},
					},
				],
			],
		};
	}
}
