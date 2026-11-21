# 🚀 Project 1: CloudVault — Cloud-Native Asynchronous Asset Processing Pipeline
**Target Roles:** SDE Intern / Cloud Engineer Intern / Backend Intern (Pune)  
**Primary Tech Stack:** Node.js / Express (or ASP.NET Core), AWS S3 (Presigned URLs), Docker, PostgreSQL, Redis / BullMQ, GitHub Actions  
**Live Target Domain:** `vault.vanshikaalag.com` (or embedded in `vanshikaalag.com`)

---

## 1. Why This Is the #1 Project to Get Hired in Pune

Most college graduates present basic CRUD applications (To-Do apps, blog clones, or simple eCommerce templates) that recruiters ignore. In Pune, top employers (**Druva, Icertis, MindTickle, Coditas, Veritas, Barclays**) build cloud-scale platforms that deal with **large file payloads, asynchronous background processing, zero-trust cloud security, and relational data integrity**.

### What This Project Proves to an Engineering Manager:
1. **Cloud Architecture Knowledge:** You understand how to bypass server bottlenecks by having clients upload directly to AWS S3 using **Presigned URLs**.
2. **Asynchronous Task Processing:** You know how to decouple heavy tasks (file validation, virus/mime checking, metadata extraction, thumbnail generation) from the API using an async worker queue (Redis / BullMQ).
3. **Database Design:** You can design a normalized PostgreSQL schema with ACID transaction safety and state machines (`PENDING`, `UPLOADING`, `PROCESSING`, `COMPLETED`, `FAILED`).
4. **DevOps & Production Readiness:** You can containerize multi-service applications using **Docker Compose** and deploy via **GitHub Actions**.

---

## 2. High-Level System Architecture

```
                  ┌───────────────────────────────────────────────────┐
                  │                    React Client                   │
                  └──────┬─────────────────────────────────────▲──────┘
                         │                                     │
           1. Request S3 │                       4. Direct S3  │ 6. Real-time
           Presigned URL │                       Upload (0 load│ WebSocket /
                         │                       on server)    │ Polling
                         ▼                                     │ Status
                  ┌──────────────┐                             │
                  │ Express API  ├────────────────────────┐    │
                  │ (Docker)     │ 2. Generate Presigned  │    │
                  └──────┬───────┘    URL with IAM Policy │    │
                         │                                ▼    │
           3. Log Upload │                       ┌─────────────┴──────┐
              in DB      │                       │     AWS S3 Bucket  │
                         ▼                       │ (Private + IAM OAC)│
                  ┌──────────────┐               └────────┬───────────┘
                  │  PostgreSQL  │                        │
                  │  (Database)  │                        │ 5. Trigger Queue Job
                  └──────▲───────┘                        ▼
                         │                       ┌────────────────────┐
                         │ 7. Update Metadata    │ Async Worker Queue │
                         └───────────────────────┤ (Redis + BullMQ)   │
                                                 └────────────────────┘
```

---

## 3. Core Features Breakdown

### Module 1: Secure Authentication & Role-Based Access
* JWT authentication with access and refresh tokens.
* User quotas (e.g., maximum 50MB storage per free-tier account).

### Module 2: The Direct S3 Presigned Upload Engine
* **The Flaw of Traditional Uploads:** Uploading a 50MB file directly to an Express/Node server consumes RAM, locks event loop threads, and causes server crashes during traffic spikes.
* **The Cloud-Native Way:** 
  1. Frontend sends file metadata (`fileName`, `fileType`, `fileSize`) to `/api/files/upload-url`.
  2. Backend validates size/extension, generates a time-limited **AWS S3 PutObject Presigned URL** (valid for 5 minutes), and creates a `PENDING` record in PostgreSQL.
  3. Frontend uploads the raw binary file directly to S3 via HTTP PUT.

### Module 3: Asynchronous Worker Pipeline
* Once the upload completes, an event triggers an asynchronous job in **BullMQ (Redis-backed)**.
* The worker service:
  - Fetches the file stream from S3.
  - Extracts metadata (dimensions for images, page counts for PDFs, MIME-type verification).
  - Generates optimized thumbnails / previews and writes back to S3.
  - Updates the PostgreSQL record state from `PROCESSING` to `COMPLETED`.

### Module 4: CloudFront CDN Integration & Secure Access
* Files in S3 remain private (`Block Public Access` enabled).
* Downloads/views are generated via **GetSignedUrl** or CloudFront signed cookies to ensure only authorized owners can access assets.

---

## 4. Database Schema (PostgreSQL)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE file_status AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) UNIQUE NOT NULL,
    status file_status DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_status ON files(status);
```

---

## 5. Step-by-Step Implementation Roadmap

### Phase 1: Local Backend & Docker Setup (Day 1)
1. Initialize project repository: `cloudvault-engine`.
2. Create `docker-compose.yml` orchestrating:
   - `postgres:16-alpine`
   - `redis:7-alpine`
   - `backend-api` (Node.js/Express with TypeScript)
3. Setup PostgreSQL connection with Prisma ORM or Knex.js.
4. Implement JWT authentication (`/register`, `/login`, `/me`).

### Phase 2: AWS S3 & Presigned URL Flow (Day 2)
1. Setup AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
2. Create IAM policy with least-privilege `s3:PutObject` and `s3:GetObject` permissions.
3. Build `/api/files/get-presigned-url` endpoint.
4. Build `/api/files/confirm-upload` endpoint that queues the job to BullMQ.

### Phase 3: Worker Microservice & Background Queue (Day 3)
1. Build the standalone worker process listening to the Redis queue.
2. Implement file validation, image resizing (using `sharp`), or PDF analysis (using `pdf-parse`).
3. Handle error cases gracefully (mark file as `FAILED` if corruption occurs).

### Phase 4: Frontend UI & Deployment (Day 4–5)
1. Build a sleek dashboard with React, Vite, and Tailwind CSS.
2. File drag-and-drop zone with real-time upload progress bar.
3. Live status updates for asynchronous processing.
4. Setup GitHub Actions workflow to build and deploy Docker containers to an AWS EC2 instance or AWS App Runner.
5. Point DNS record `vault.vanshikaalag.com` to the live service.

---

## 6. How to Talk About This Project in Interviews

When an interviewer at Druva, Coditas, or Icertis says: *"Tell me about your most technically challenging project."*

> **Your Answer:**  
> *"I built CloudVault, a cloud-native asynchronous file processing platform designed to handle large file ingestion without degrading backend API performance. Instead of piping heavy multi-megabyte payloads through the Node.js event loop, I architected a presigned URL mechanism where the client uploads directly to AWS S3 under strict IAM constraints. Once uploaded, an event-driven worker running BullMQ and Redis takes over to process metadata and generate previews asynchronously, updating PostgreSQL transaction records. The entire system is containerized with Docker and deployed via CI/CD pipelines under my custom domain."*
