import bcrypt from 'bcryptjs';
import { pool } from '../../config/db';

export async function runSeed() {
  console.log('Seeding initial database data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Roles
    await client.query(`
      INSERT INTO roles (id, name) VALUES
      (1, 'student'),
      (2, 'instructor'),
      (3, 'admin')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 2. Passwords
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 3. Users
    const studentRes = await client.query(`
      INSERT INTO users (full_name, email, password_hash, avatar_url)
      VALUES ('Alex Johnson', 'student@lms.local', $1, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [passwordHash]);
    const studentId = studentRes.rows[0].id;

    const instructorRes = await client.query(`
      INSERT INTO users (full_name, email, password_hash, avatar_url)
      VALUES ('Dr. Priya Sharma', 'instructor@lms.local', $1, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [passwordHash]);
    const instructorId = instructorRes.rows[0].id;

    const adminRes = await client.query(`
      INSERT INTO users (full_name, email, password_hash, avatar_url)
      VALUES ('Admin Supervisor', 'admin@lms.local', $1, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id;
    `, [passwordHash]);
    const adminId = adminRes.rows[0].id;

    // 4. User Roles
    await client.query(`
      INSERT INTO user_roles (user_id, role_id) VALUES
      ($1, 1),
      ($2, 2),
      ($3, 3)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    `, [studentId, instructorId, adminId]);

    // 5. Badges
    await client.query(`
      INSERT INTO badges (id, name, description, icon_url) VALUES
      (1, 'Quick Starter', 'Completed your first interactive lecture', '🚀'),
      (2, 'Quiz Master', 'Scored 100% on a course assessment', '🏆'),
      (3, '7-Day Streak', 'Maintained a 7-day daily study streak', '🔥'),
      (4, 'Code Pioneer', 'Successfully submitted an AI engineering assignment', '💡')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
    `);

    // Assign badges to student
    await client.query(`
      INSERT INTO user_badges (user_id, badge_id) VALUES
      ($1, 1),
      ($1, 2)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    `, [studentId]);

    // 6. Streaks
    await client.query(`
      INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date)
      VALUES ($1, 5, 12, CURRENT_DATE)
      ON CONFLICT (user_id) DO UPDATE SET current_streak = 5, longest_streak = 12;
    `, [studentId]);

    // 7. Courses
    // Course 1: Approved
    const courseRes = await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Full-Stack AI Engineering: From RAG to Autonomous Agents',
        'Master the end-to-end development of modern AI applications. Learn dense vector search, pgvector indexing, hybrid retrieval, agentic reasoning loops, tool calling, and production deployment patterns.',
        'Artificial Intelligence',
        'intermediate',
        'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
        49.99,
        'approved',
        4.9,
        128
      )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [instructorId]);
    const courseId = courseRes.rows.length > 0 ? courseRes.rows[0].id : (await client.query('SELECT id FROM courses LIMIT 1')).rows[0].id;

    // Course 2: Advanced Kubernetes (Approved)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Advanced Kubernetes & Cloud-Native Microservices',
        'Deep dive into container orchestration, service meshes, Ingress controllers, Helm charts, stateful sets, and GitOps workflows for cloud scale.',
        'DevOps & Cloud',
        'advanced',
        'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=800&q=80',
        79.99,
        'approved',
        4.8,
        94
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // Course 3: Generative AI & Prompt Engineering (Approved, Beginner)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Generative AI & Prompt Engineering Masterclass',
        'Learn prompt engineering, few-shot conditioning, structured JSON outputs, function calling, and embedding pipelines with modern LLMs.',
        'Artificial Intelligence',
        'beginner',
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80',
        29.99,
        'approved',
        4.7,
        210
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // Course 4: Modern Web Development (Approved, Beginner)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Full-Stack Web Development with React 19 & Next.js',
        'Build production web applications with React Server Components, TypeScript, Tailwind CSS, API routes, and modern authentication.',
        'Web Development',
        'beginner',
        'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80',
        39.99,
        'approved',
        4.5,
        175
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // Course 5: Production Docker & CI/CD (Approved, Intermediate)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Production Docker & CI/CD with GitHub Actions',
        'Automate testing, build multi-stage Docker containers, optimize layer caching, and manage zero-downtime deployment pipelines.',
        'DevOps & Cloud',
        'intermediate',
        'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=800&q=80',
        44.99,
        'approved',
        4.4,
        88
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // Course 6: Data Engineering with Kafka & Spark (Approved, Intermediate)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Data Engineering with Apache Kafka & Spark',
        'Architect high-throughput event-driven data streaming pipelines, partitioning strategies, schema registries, and real-time analytical transformations.',
        'Data Science',
        'intermediate',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        59.99,
        'approved',
        4.6,
        145
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // Course 7: Cybersecurity Fundamentals (Approved, Beginner)
    await client.query(`
      INSERT INTO courses (instructor_id, title, description, category, difficulty, thumbnail_url, price, status, rating, ratings_count)
      VALUES (
        $1,
        'Practical Cybersecurity & Network Defense',
        'Fundamental defensive security operations, threat modeling, web vulnerabilities, encryption standards, and incident response fundamentals.',
        'Cybersecurity',
        'beginner',
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
        34.99,
        'approved',
        4.2,
        62
      )
      ON CONFLICT DO NOTHING;
    `, [instructorId]);

    // 8. Modules for Course 1
    const mod1Res = await client.query(`
      INSERT INTO modules (course_id, title, order_index)
      VALUES ($1, 'Module 1: Foundations of RAG and Vector Databases', 1)
      RETURNING id;
    `, [courseId]);
    const mod1Id = mod1Res.rows[0].id;

    const mod2Res = await client.query(`
      INSERT INTO modules (course_id, title, order_index)
      VALUES ($1, 'Module 2: Agentic Workflows & Multi-Agent Systems', 2)
      RETURNING id;
    `, [courseId]);
    const mod2Id = mod2Res.rows[0].id;

    // 9. Lectures for Module 1
    const lec1Transcript = `Welcome to Lecture 1 on Vector Embeddings and Cosine Distance. In this session, we explore high-dimensional semantic spaces. When a document is processed, a transformer model encodes its semantic meaning into a numerical vector of fixed dimensions, typically 1536 dimensions for models like OpenAI text-embedding-3-small or Ada-002.
    Cosine similarity measures the cosine of the angle between two non-zero vectors in an inner product space. Unlike Euclidean distance, which measures the absolute distance between points in space, cosine distance is magnitude-invariant, making it ideal for text comparison where document length may vary.
    In PostgreSQL with pgvector, we use the vector_cosine_ops operator class and create an IVFFlat or HNSW index to achieve sub-millisecond retrieval across millions of chunk embeddings.`;

    const lec1Res = await client.query(`
      INSERT INTO lectures (module_id, title, video_url, transcript, duration_seconds, order_index, resource_urls)
      VALUES (
        $1,
        'Embeddings & Vector Search Architecture',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        $2,
        480,
        1,
        ARRAY['https://example.com/slides/lecture-1.pdf']
      )
      RETURNING id;
    `, [mod1Id, lec1Transcript]);
    const lec1Id = lec1Res.rows[0].id;

    const lec2Transcript = `In Lecture 2, we dissect Chunking Strategies and Context Retrieval. Raw documents such as PDFs or video transcripts cannot simply be passed to LLMs in bulk due to context limits, cost, and the "lost-in-the-middle" phenomenon.
    We employ recursive character chunking with a 500-character chunk size and a 50-character overlap. The overlap ensures sentences crossing chunk boundaries do not lose context.
    Furthermore, we implement metadata tagging: every chunk stores course_id, module_id, lecture_id, and start timestamp. During query retrieval, we first filter by course_id to guarantee multi-tenant security and prevent data leakage, then rank top-k nearest chunks using vector cosine distance.`;

    const lec2Res = await client.query(`
      INSERT INTO lectures (module_id, title, video_url, transcript, duration_seconds, order_index, resource_urls)
      VALUES (
        $1,
        'Chunking Strategies & Context Retrieval',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        $2,
        620,
        2,
        ARRAY['https://example.com/code/chunking-pipeline.py']
      )
      RETURNING id;
    `, [mod1Id, lec2Transcript]);
    const lec2Id = lec2Res.rows[0].id;

    // Lecture for Module 2
    const lec3Transcript = `Lecture 3 covers the ReAct Agent Loop: Reasoning and Acting. An autonomous agent doesn't just produce text in a single pass. Instead, it maintains a cycle: thought, action, observation, until a final answer is reached.
    In modern systems, tool calling is standardized. The LLM produces a structured JSON payload targeting a registered function schema, such as search_knowledge_base or execute_python_code. The runtime executes the tool and feeds the result back to the model as an observation.`;

    const lec3Res = await client.query(`
      INSERT INTO lectures (module_id, title, video_url, transcript, duration_seconds, order_index, resource_urls)
      VALUES (
        $1,
        'Building ReAct Agents with Tool Calling',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        $2,
        750,
        1,
        ARRAY['https://example.com/diagrams/react-agent.png']
      )
      RETURNING id;
    `, [mod2Id, lec3Transcript]);
    const lec3Id = lec3Res.rows[0].id;

    // 10. Student Enrollment & Progress
    const enrollRes = await client.query(`
      INSERT INTO enrollments (user_id, course_id, progress_percent)
      VALUES ($1, $2, 50.0)
      RETURNING id;
    `, [studentId, courseId]);
    const enrollId = enrollRes.rows[0].id;

    await client.query(`
      INSERT INTO lecture_progress (enrollment_id, lecture_id, watched_seconds, completed)
      VALUES
      ($1, $2, 480, TRUE),
      ($1, $3, 120, FALSE);
    `, [enrollId, lec1Id, lec2Id]);

    // Notes & Bookmarks
    await client.query(`
      INSERT INTO notes (user_id, lecture_id, timestamp_seconds, content)
      VALUES ($1, $2, 145, 'Key insight: Cosine distance is scale invariant, unlike Euclidean distance.');
    `, [studentId, lec1Id]);

    await client.query(`
      INSERT INTO bookmarks (user_id, lecture_id, timestamp_seconds)
      VALUES ($1, $2, 210);
    `, [studentId, lec1Id]);

    // 11. Quizzes
    const quizRes = await client.query(`
      INSERT INTO quizzes (module_id, title, is_ai_generated, generated_from_lecture_id)
      VALUES ($1, 'RAG Foundations & Embeddings Assessment', FALSE, $2)
      RETURNING id;
    `, [mod1Id, lec1Id]);
    const quizId = quizRes.rows[0].id;

    // Question 1
    const q1Res = await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
      VALUES ($1, 'Why is Cosine Similarity preferred over Euclidean Distance for text embeddings?', 'mcq', 1)
      RETURNING id;
    `, [quizId]);
    const q1Id = q1Res.rows[0].id;

    await client.query(`
      INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES
      ($1, 'Cosine similarity is invariant to vector magnitude/document length', TRUE),
      ($1, 'Euclidean distance cannot be computed in more than 3 dimensions', FALSE),
      ($1, 'Cosine similarity runs in O(1) time complexity always', FALSE),
      ($1, 'Euclidean distance requires integer values only', FALSE);
    `, [q1Id]);

    // Question 2
    const q2Res = await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
      VALUES ($1, 'What is the purpose of chunk overlap in text preprocessing for RAG?', 'mcq', 2)
      RETURNING id;
    `, [quizId]);
    const q2Id = q2Res.rows[0].id;

    await client.query(`
      INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES
      ($1, 'To prevent semantic context from being severed across chunk boundaries', TRUE),
      ($1, 'To compress the file size in the vector database', FALSE),
      ($1, 'To encrypt the vector embeddings against unauthorized queries', FALSE),
      ($1, 'To force the LLM to output responses faster', FALSE);
    `, [q2Id]);

    // Question 3: Multi-select
    const q3Res = await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
      VALUES ($1, 'Select all valid vector distance metrics supported in pgvector:', 'multi_select', 3)
      RETURNING id;
    `, [quizId]);
    const q3Id = q3Res.rows[0].id;

    await client.query(`
      INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES
      ($1, 'Cosine distance (<=>)', TRUE),
      ($1, 'L2 distance / Euclidean (<->)', TRUE),
      ($1, 'Inner product (<#>)', TRUE),
      ($1, 'MD5 hash distance', FALSE);
    `, [q3Id]);

    // Question 4: Short answer
    const q4Res = await client.query(`
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index)
      VALUES ($1, 'Name the open-source PostgreSQL extension used for high-dimensional vector similarity search:', 'short_answer', 4)
      RETURNING id;
    `, [quizId]);
    const q4Id = q4Res.rows[0].id;

    await client.query(`
      INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES
      ($1, 'pgvector', TRUE);
    `, [q4Id]);

    // 12. Assignments
    await client.query(`
      INSERT INTO assignments (course_id, title, instructions, rubric, due_date)
      VALUES (
        $1,
        'Design a Production RAG Ingestion Pipeline',
        'Write a Python script that takes a PDF document, applies sliding window chunking with metadata, stores vectors in pgvector, and demonstrates course-filtered retrieval.',
        '{"accuracy": 40, "code_cleanliness": 30, "metadata_handling": 30}'::JSONB,
        now() + interval '14 days'
      );
    `, [courseId]);

    // 13. Flashcards
    await client.query(`
      INSERT INTO flashcards (module_id, question, answer) VALUES
      ($1, 'What is IVFFlat in pgvector?', 'An inverted file index that partitions vectors into lists via k-means clustering for fast approximate nearest neighbor search.'),
      ($1, 'What is the "lost-in-the-middle" phenomenon?', 'The tendency of large language models to focus on the beginning and end of long context windows while missing information in the middle.'),
      ($1, 'What does RAG stand for?', 'Retrieval-Augmented Generation: retrieving external factual context dynamically to ground LLM generations.')
    `, [mod1Id]);

    // 14. Document Chunks (Vector Store) with sample 1536-dim vector for immediate retrieval
    const sampleVec = '[' + Array(1536).fill(0.025).join(',') + ']';
    await client.query(`
      INSERT INTO document_chunks (course_id, lecture_id, chunk_text, embedding) VALUES
      ($1, $2, $3, $5::vector),
      ($1, $4, $6, $5::vector);
    `, [courseId, lec1Id, lec1Transcript, lec2Id, sampleVec, lec2Transcript]);

    // 15. Discussions & Announcements
    const threadRes = await client.query(`
      INSERT INTO discussion_threads (course_id, created_by, title)
      VALUES ($1, $2, 'How do you choose between HNSW and IVFFlat indexes in pgvector?')
      RETURNING id;
    `, [courseId, studentId]);
    const threadId = threadRes.rows[0].id;

    await client.query(`
      INSERT INTO discussion_posts (thread_id, user_id, content)
      VALUES ($1, $2, 'HNSW provides higher recall and faster query performance with slightly higher memory and build time, whereas IVFFlat is lighter to construct.');
    `, [threadId, instructorId]);

    await client.query(`
      INSERT INTO announcements (course_id, posted_by, content)
      VALUES ($1, $2, 'Welcome to Full-Stack AI Engineering! Live Q&A session scheduled for this Friday.');
    `, [courseId, instructorId]);

    // 16. Notifications
    await client.query(`
      INSERT INTO notifications (user_id, title, body, is_read)
      VALUES
      ($1, 'Welcome to LMS-AI!', 'Explore your courses, try the AI Tutor, and keep your daily streak going!', FALSE),
      ($1, 'New Announcement', 'Dr. Priya Sharma posted an announcement in Full-Stack AI Engineering.', FALSE);
    `, [studentId]);

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
