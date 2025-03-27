# MCP Dall-E SSE Server

A MCP SSE server for generating images via OpenAI Dall-E model.

## Description

This project is a server-side implementation that utilizes OpenAI's Dall-E model to generate images based on text prompts. It leverages Server-Sent Events (SSE) to provide a real-time image generation experience.

## Features

- **Real-time Image Generation**: Generate images in real-time using OpenAI's Dall-E model.
- **Server-Sent Events**: Stream the image generation process to clients using SSE.
- **Multi-client Support**: Supports multiple SSE clients connecting to the server simultaneously.
- **JavaScript and TypeScript**: Written primarily in JavaScript and TypeScript for robust and scalable development.

## Language Composition

- **JavaScript**: 60.4%
- **TypeScript**: 38.4%
- **Dockerfile**: 1.2%

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or above)
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/weester-yan/mcp-dalle-sse-server.git
    cd mcp-dalle-sse-server
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

### Usage

1. Start the server:

    ```bash
    npm start
    ```

2. Access the server:

    Open your web browser and navigate to `http://localhost:3000`.

### Docker Deployment

1. Build the Docker image:

    ```bash
    docker build -t mcp-dalle-sse-server .
    ```

2. Run the Docker container:

    ```bash
    docker run -p 3000:3000 mcp-dalle-sse-server
    ```

### Configuration

Configuration options can be set using environment variables:

- `PORT`: The port on which the server will run (default: `3000`).
- `OPENAI_API_KEY`: Your OpenAI API key for accessing the Dall-E model.

### Contributing

Contributions are welcome! Please submit a pull request or open an issue to discuss any changes.

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Acknowledgements

- OpenAI for providing the Dall-E model.
- The contributors who have helped improve this project.
