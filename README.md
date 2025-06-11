# Agentic RAG Platform

An advanced multi-jurisdictional AI regulatory analysis platform with intelligent document processing and dynamic query routing.

## Features

- **Multi-Agent Architecture**: Cross-jurisdictional legal analysis with specialized agents
- **Document Processing**: Advanced PDF extraction with OCR support for multiple languages
- **RAG System**: Vector-based document search and retrieval
- **Multi-Jurisdiction Support**: California, Colorado, EU, Germany, US Federal regulatory documents
- **Real-time Chat**: WebSocket-based conversation system
- **Document Management**: Upload, view, and organize legal documents by jurisdiction

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI/ML**: OpenAI GPT-4 + Embeddings, Tesseract.js OCR
- **Document Processing**: PDF parsing, Google Drive integration

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- OpenAI API key

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/database
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

### Installation

```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## Docker Deployment

### Build and Run

```bash
# Build the Docker image
docker build -t agentic-rag .

# Run with environment variables
docker run -p 5000:5000 \
  -e DATABASE_URL=your_database_url \
  -e OPENAI_API_KEY=your_openai_key \
  agentic-rag
```

### Docker Compose

```bash
# Start all services
docker-compose up -d
```

## Usage

1. **Upload Documents**: Select a jurisdiction and upload PDF documents
2. **Query System**: Ask questions about regulatory content across jurisdictions
3. **View Documents**: Browse and read full document content
4. **Multi-Jurisdiction Queries**: Compare regulations across different regions

## API Endpoints

- `POST /api/documents/upload` - Upload documents
- `GET /api/documents` - List documents by jurisdiction
- `POST /api/query` - Submit queries to the RAG system
- `GET /api/conversations` - Retrieve conversation history

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License