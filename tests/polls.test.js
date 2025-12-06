const request = require('supertest');
const app = require('../server');
const { initDatabase } = require('../database/init');

describe('Polls API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    await initDatabase();
    
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'creator@admin.com',
        password: 'password123'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'creator@admin.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;
  });

  describe('POST /api/polls', () => {
    it('should create a new poll', async () => {
      const response = await request(app)
        .post('/api/polls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Poll',
          description: 'This is a test poll',
          poll_type: 'single',
          options: ['Option 1', 'Option 2', 'Option 3']
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('pollId');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/polls')
        .send({
          title: 'Test Poll',
          options: ['Option 1', 'Option 2']
        });

      expect(response.status).toBe(401);
    });

    it('should require at least 2 options', async () => {
      const response = await request(app)
        .post('/api/polls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1']
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/polls/available', () => {
    it('should return available polls', async () => {
      const response = await request(app)
        .get('/api/polls/available')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

