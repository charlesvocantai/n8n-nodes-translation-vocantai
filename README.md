![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# @vocantai/n8n-nodes-translation-vocantai

This is an n8n community node package that provides audio transcription services using VocantAI. It lets you upload audio files and receive transcribed text in your n8n workflows.

VocantAI offers private, secure speech-to-text transcription services with high accuracy and fast processing times.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

For manual installation:

```bash
npm install @vocantai/n8n-nodes-translation-vocantai
```

## Operations

### VocantAI Node

- **Upload Audio**: Upload audio files for transcription using presigned URLs
- **Get Transcription**: Retrieve completed transcription results
- **Check Status**: Monitor transcription job status

### VocantAI Callback Trigger

- **Webhook Trigger**: Receives transcription completion callbacks
- **File Download**: Automatically downloads completed transcription files
- **Binary Output**: Provides transcribed text as binary data for further processing

## Compatibility

- Minimum n8n version: 1.0.0
- Tested against n8n versions: 1.0.0 - 1.5.0
- Node.js version: 20+

## Usage

### Setting up Credentials

1. Create a VocantAI account and obtain your API key
2. In n8n, add new credentials for "Vocant AI API"
3. Enter your API key

### Basic Workflow

1. **File Input**: Use nodes like Google Drive, HTTP Request, or Read Binary File to provide audio files
2. **VocantAI Upload**: Add the VocantAI node to upload your audio file
3. **Callback Setup**: Add the VocantAI Callback trigger to receive results
4. **Process Results**: Use the transcribed text in subsequent workflow steps

### Example Workflow

```
Google Drive → VocantAI → [Process continues...]
                ↓
VocantAI Callback → Write Binary File / Further Processing
```

### Configuration Options

- **Binary Input Field**: Specify which field contains the audio file (default: "data")
- **Callback URL**: Your n8n webhook URL for receiving results
- **Use Original Filename**: Toggle to use original filename as base for transcription file

## Supported Audio Formats

VocantAI supports various audio formats including:

- MP3
- WAV
- M4A
- FLAC
- And more...

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [VocantAI Website](https://vocant.ai)
- [VocantAI API Documentation](https://app.vocant.ai/docs)
- [GitHub Repository](https://github.com/VocantAI/n8n-nodes-translation-vocantai)

## Version history

### 0.1.0

- Initial release
- Audio file upload via presigned URLs
- Webhook callback support for transcription results
- Automatic file download and binary output
- Support for original filename preservation
- Status checking capabilities

## Development

To set up the development environment:

```bash
git clone https://github.com/VocantAI/n8n-nodes-translation-vocantai.git
cd n8n-nodes-translation-vocantai
pnpm install
pnpm run build
```

## License

[MIT](LICENSE.md)

## Support

For issues and feature requests, please visit our [GitHub Issues](https://github.com/VocantAI/n8n-nodes-translation-vocantai/issues) page.

For VocantAI API support, contact: dev@vocant.ai
