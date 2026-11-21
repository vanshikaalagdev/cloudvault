import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/file.routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config/env';

const app: Application = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS configuration
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cloudvault-api',
    storageProvider: config.storage.provider,
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cloudvault-api',
    storageProvider: config.storage.provider,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Centralized error handling
app.use(errorHandler);

export default app;
