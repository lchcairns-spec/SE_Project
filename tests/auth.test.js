const request = require('supertest');
const app = require('../server');
const { initDatabase, getDatabase } = require('../database/init');

describe('Authentication API', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with HKMU email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@hkmu.edu.hk',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('userId');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test2@hkmu.edu.hk',
          password: '12345'
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-HKMU email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@gmail.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@hkmu.edu.hk',
          password: 'password123'
        });

      // Then login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@hkmu.edu.hk',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@hkmu.edu.hk',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });
});

