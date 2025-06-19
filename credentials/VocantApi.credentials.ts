import {
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class VocantApi implements ICredentialType {
    name = 'vocantApi';
    displayName = 'Vocant AI API';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
        },
    ];
}