# 🚀 CloudVault — Cloud-Native Asynchronous Asset Processing Pipeline

> **Zero-Load S3 Presigned Upload Engine & Asynchronous Asset Processing Microservice Pipeline**  
> *Built with Node.js, Express, TypeScript, AWS S3 / MinIO, BullMQ, Redis, PostgreSQL, Prisma ORM, Sharp, and React.*

---

## 📑 Table of Contents
1. [Architectural Overview](#-architectural-overview)
2. [Why This Architecture Matters](#-why-this-architecture-matters)
3. [The Zero-Load Direct S3 Upload Pattern](#-the-zero-load-direct-s3-upload-pattern)
4. [Dual Storage Architecture (MinIO vs AWS S3)](#-dual-storage-architecture-minio-vs-aws-s3)
5. [System Components](#-system-components)
6. [Database Schema & State Machine](#-database-schema--state-machine)
7. [API Specification](#-api-specification)
8. [Quick Start & One-Command Docker Orchestration](#-quick-start--one-command-docker-orchestration)
9. [Running in Hybrid / Local Development Mode](#-running-in-hybrid--local-development-mode)
10. [Production AWS S3 Deployment Guide](#-production-aws-s3-deployment-guide)
11. [Interview Talking Points & System Design Defense](#-interview-talking-points--system-design-defense)

---

## 🏛️ Architectural Overview

```
                                  ┌─────────────────────────────────────────┐
                                  │           React Vite Dashboard          │
                                  └────┬───────────────────────────────▲────┘
                                       │                               │
        1. Request Presigned URL       │               3. Direct HTTP  │ 5. Real-Time
        (Metadata: name, size, mime)   │                  PUT Binary   │    Status Polling /
                                       ▼                  Upload       │    Event Updates
                                ┌──────────────┐          (0 CPU/RAM)  │
                                │ Express REST ├──────────────┐        │
                                │ API Server   │              │        │
                                └──────┬───────┘ 2. S3 Signed │        │
                                       │            PUT URL   ▼        │
                  4. Confirm Upload &  │            ┌──────────────────┴──┐
                     Update DB State   │            │   AWS S3 / MinIO    │
                                       ▼            │  Private Asset Store│
                                ┌──────────────┐    └─────────┬───────────┘
                                │  PostgreSQL  │              │
                                │  (Prisma)    │              │ 4b. Push Job
                                └──────▲───────┘              ▼
                                       │            ┌─────────────────────┐
                                       │            │ Redis 7 + BullMQ    │
                                       │            │ Task Queue          │
                                       │            └─────────┬───────────┘
                                       │                      │
                                       │ 4d. Complete Record  │ 4c. Consume & Process
                                       │     & Store Metadata ▼
                                       └────────────┌─────────────────────┐
                                                    │ Standalone Worker   │
                                                    │ (Sharp, PDF, SHA256)│
                                                    └─────────────────────┘
```

---

## 💡 Why This Architecture Matters

In high-throughput platforms (such as **Druva, MindTickle, Icertis, Barclays, Coditas**), standard file upload architectures fail under load:

* ❌ **The Anti-Pattern (Streaming files through Express/Node API):**
  When a user uploads a 50MB file through standard multipart form handlers (`multer` or raw streams), Node.js buffers chunks into RAM, locks the single-threaded event loop during encryption/disk I/O, and causes HTTP request timeouts and 502/504 gateway crashes during traffic surges.
* ✅ **The Cloud-Native Solution (Presigned S3 Direct Upload):**
  The API never touches raw file binaries. Instead, the API validates user quota and permissions, creates an authorized, time-limited **AWS S3 PutObject Presigned URL**, and returns it to the client. The browser streams bytes directly to object storage over HTTPS with high-performance multipart capabilities. Once storage acknowledges receipt, the client confirms with the API, which offloads processing to an asynchronous worker queue.

---

## 🔄 The Zero-Load Direct S3 Upload Pattern

```
Client (Browser)             CloudVault API             AWS S3 / MinIO          BullMQ Worker
      │                            │                           │                      │
      │ 1. POST /get-presigned-url │                           │                      │
      ├───────────────────────────>│                           │                      │
      │    (fileName, size, mime)  │ (Check quota, create      │                      │
      │                            │  PENDING file in DB)      │                      │
      │                            │                           │                      │
      │                            │ 2. Generate Presigned URL │                      │
      │                            ├──────────────────────────>│                      │
      │                            │<──────────────────────────┤                      │
      │ 3. { uploadUrl, fileId }   │                           │                      │
      │<───────────────────────────┤                           │                      │
      │                                                        │                      │
      │ 4. HTTP PUT raw binary directly to presigned URL       │                      │
      ├───────────────────────────────────────────────────────>│                      │
      │    (Track progress in client UI: 0% -> 100%)           │                      │
      │<───────────────────────────────────────────────────────┤                      │
      │                                                        │                      │
      │ 5. POST /confirm-upload { fileId }                     │                      │
      ├───────────────────────────>│                           │                      │
      │                            │ (Verify S3 HeadObject,    │                      │
      │                            │  mark PROCESSING in DB)   │                      │
      │                            │                           │                      │
      │                            │ 6. Enqueue BullMQ Job     │                      │
      │                            ├─────────────────────────────────────────────────>│
      │ 7. 200 OK (Status: QUEUED) │                           │                      │
      │<───────────────────────────┤                           │                      │
      │                                                        │ 7. Download stream   │
      │                                                        │<─────────────────────┤
      │                                                        │                      │
      │                                                        │ (Sharp resize, PDF,  │
      │                                                        │  calculate SHA-256)  │
      │                                                        │                      │
      │                                                        │ 8. Upload Thumbnail  │
      │                                                        ├─────────────────────>│
      │                                                        │                      │
      │                                                        │ 9. Update DB Status: │
      │                                                        │    COMPLETED + JSON  │
      │                                                        │                      │
      │ 10. Poll /files -> Real-time status update to COMPLETED│                      │
      │<──────────────────────────────────────────────────────────────────────────────│
```

---

## 🗄️ Dual Storage Architecture (MinIO vs AWS S3)

CloudVault features an enterprise-grade abstraction layer over the AWS SDK v3:

```typescript
// backend/src/config/s3.ts
const clientConfig: S3ClientConfig = {
  region: config.storage.region,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
};

// Seamless local testing via MinIO
if (config.storage.provider === 'minio' || config.storage.endpoint) {
  clientConfig.endpoint = config.storage.endpoint;
  clientConfig.forcePathStyle = config.storage.forcePathStyle;
}

export const s3Client = new S3Client(clientConfig);
```

### Switching Environments:
* **Local Development (`STORAGE_PROVIDER=minio`):** Runs against the local Dockerized MinIO instance at `http://localhost:9000`. Zero cost, zero AWS account required.
* **Production Cloud (`STORAGE_PROVIDER=aws`):** Remove the endpoint override and supply IAM credentials. The exact same SDK calls execute directly against production AWS S3.

---

## 📦 System Components

### 1. Backend REST API (`/backend`)
* **Framework:** Express + TypeScript
* **Database ORM:** Prisma ORM connecting to PostgreSQL 16
* **Authentication:** JWT with Bearer tokens, bcrypt salted password hashing (10 rounds)
* **Validation:** Zod schemas for all inbound requests
* **Security:** Helmet, CORS, parameterized queries, least-privilege presigned upload constraints

### 2. Standalone Async Worker (`/worker`)
* **Queue Engine:** BullMQ backed by Redis 7
* **Processing Capabilities:**
  * **Cryptographic Checksum:** SHA-256 calculation for file integrity verification.
  * **Image Pipeline:** `sharp` extraction of dimensions (width, height, channels, alpha) and auto-generation of 300x300 WebP preview thumbnails uploaded to `thumbnails/<key>`.
  * **Document Pipeline:** `pdf-parse` extraction of page counts, PDF versions, and search snippets.
  * **Resilience:** Automatic retry with exponential backoff; failures recorded gracefully with state `FAILED` and error reasons.

### 3. Frontend Dashboard (`/frontend`)
* **Tech Stack:** React 18, Vite, Tailwind CSS, Lucide Icons, Axios
* **Features:**
  * Clean Login & Registration interfaces with demo-credential fill.
  * Real-time User Storage Quota progress bar with warning indicators.
  * Drag-and-drop upload zone with real-time progress bar (0% -> 100%) tracking direct PUT streams to S3.
  * Interactive file table with status badges (`PENDING`, `UPLOADING`, `PROCESSING`, `COMPLETED`, `FAILED`).
  * Modal image thumbnail previews.
  * Metadata inspection side-drawer showcasing SHA-256 checksums, dimensions, and raw JSONB data.
  * Secure presigned GET downloads.

---

## 🗃️ Database Schema & State Machine

```prisma
enum FileStatus {
  PENDING       // Presigned URL issued; waiting for client to PUT to S3
  UPLOADING     // Client streaming raw bytes to storage
  PROCESSING    // Upload verified via S3 HeadObject; BullMQ worker processing
  COMPLETED     // Worker extracted metadata & generated thumbnail preview
  FAILED        // Worker caught corrupted binary or timeout
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  storageQuota BigInt   @default(52428800) @map("storage_quota") // 50MB
  storageUsed  BigInt   @default(0) @map("storage_used")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  files        File[]

  @@map("users")
}

model File {
  id            String     @id @default(uuid())
  userId        String     @map("user_id")
  fileName      String     @map("file_name")
  fileSizeBytes BigInt     @map("file_size_bytes")
  mimeType      String     @map("mime_type")
  s3Key         String     @unique @map("s3_key")
  thumbnailKey  String?    @map("thumbnail_key")
  status        FileStatus @default(PENDING)
  metadata      Json       @default("{}")
  errorMessage  String?    @map("error_message")
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], name: "idx_files_user_id")
  @@index([status], name: "idx_files_status")
  @@map("files")
}
```

---

## 📡 API Specification

### Authentication Endpoints
| Method | Endpoint | Description | Protected |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & quota | Yes (Bearer) |

### File Management Endpoints
| Method | Endpoint | Description | Protected |
|---|---|---|---|
| `POST` | `/api/files/get-presigned-url` | Generate S3 PutObject presigned URL | Yes (Bearer) |
| `POST` | `/api/files/confirm-upload` | Confirm S3 upload & dispatch BullMQ job | Yes (Bearer) |
| `GET` | `/api/files` | List user's files with thumbnail URLs | Yes (Bearer) |
| `GET` | `/api/files/:id` | Fetch single file record and metadata | Yes (Bearer) |
| `GET` | `/api/files/:id/download` | Generate time-limited S3 GetObject download URL | Yes (Bearer) |
| `DELETE` | `/api/files/:id` | Delete asset from S3 and database | Yes (Bearer) |

---

## 🚀 Quick Start & One-Command Docker Orchestration

Launch the entire containerized architecture with a single command:

```bash
docker compose up -d --build
```

### What this starts:
1. `cloudvault-postgres`: PostgreSQL 16 on port `5432`
2. `cloudvault-redis`: Redis 7 on port `6379`
3. `cloudvault-minio`: Local S3 storage on port `9000` (API) & `9001` (Web Console)
4. `cloudvault-minio-init`: Auto-creates the `cloudvault-bucket`
5. `cloudvault-api`: Express REST API on port `5000`
6. `cloudvault-worker`: BullMQ background processing microservice
7. `cloudvault-frontend`: Nginx serving the React production build on port `3000`

### Accessing the services:
* **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
* **Backend API Health:** [http://localhost:5000/health](http://localhost:5000/health)
* **MinIO Storage Console:** [http://localhost:9001](http://localhost:9001) *(User: `minioadmin` / Pass: `minioadmin`)*

---

## 💻 Running in Hybrid / Local Development Mode

If you prefer to run services individually for hot-reloading during development:

### 1. Start Infrastructure (Postgres, Redis, MinIO)
```bash
docker compose up -d postgres redis minio minio-init
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Backend API
```bash
cd backend
npm install
npx prisma db push
npm run dev
# API running at http://localhost:5000
```

### 4. Start Background Worker
```bash
cd ../worker
npm install
npm run dev
# Worker connected to Redis queue: file-processing
```

### 5. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
# React app running at http://localhost:3000
```

---

## ☁️ Production AWS S3 Deployment Guide

When deploying to AWS:

1. **Create an S3 Bucket:**
   * Name: e.g. `vault-assets-production`
   * Enable **Block all public access** (all assets stay strictly private).
   * Enable default encryption (SSE-S3 or AWS KMS).

2. **Configure S3 Bucket CORS:**
   In S3 Console > Permissions > Cross-origin resource sharing (CORS):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedOrigins": ["https://vault.vanshikaalag.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

3. **Configure IAM User / Role:**
   Attach an IAM policy granting least privilege only on the bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::vault-assets-production/*"
       }
     ]
   }
   ```

4. **Update `.env` in Production:**
   ```env
   STORAGE_PROVIDER=aws
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=vault-assets-production
   AWS_ACCESS_KEY_ID=<YOUR_IAM_ACCESS_KEY>
   AWS_SECRET_ACCESS_KEY=<YOUR_IAM_SECRET_KEY>
   S3_ENDPOINT=
   S3_PUBLIC_ENDPOINT=
   S3_FORCE_PATH_STYLE=false
   ```

---

## 🎤 Interview Talking Points & System Design Defense

When discussing this project with hiring managers at **Druva, MindTickle, Icertis, Barclays, or Coditas**:

### Q1: "Why did you use Presigned URLs instead of uploading directly to the Express server?"
> *"If 50 users upload a 40MB file at the same time to a traditional Express server, the server must buffer up to 2GB of incoming stream data in RAM. Node's single-threaded event loop becomes overwhelmed by encryption and buffer chunks, blocking regular API queries. By using AWS S3 Presigned URLs, we offload 100% of the byte ingestion to AWS S3’s globally distributed edge infrastructure. The Express API handles only lightweight JSON metadata transactions (less than 1KB), preserving sub-10ms response times for all users."*

### Q2: "How do you prevent malicious users from confirming an upload without actually uploading the file?"
> *"In `/api/files/confirm-upload`, the API does not blindly trust the client's confirmation payload. Before transitioning the state machine from `PENDING` to `PROCESSING`, the backend calls `S3.HeadObject` with the S3 key. If the object does not exist in storage or the reported byte size does not match, the transaction is rejected and the file status is not queued."*

### Q3: "How do you handle task failures in the async queue?"
> *"We utilize BullMQ with Redis backing. Jobs are configured with exponential backoff retries (3 attempts). If processing encounters unrecoverable corruption (e.g., an invalid image binary that fails Sharp decoding), the worker catches the error, marks the PostgreSQL record as `FAILED`, and records the exact error diagnostic in `error_message` while preserving user storage quota integrity."*

---

## 👩‍💻 Author
* **Vanshika Alag**  
* Target Domain: `vault.vanshikaalag.com`
