import {Hono} from 'hono';
import {serve} from '@hono/node-server';
import {cors} from 'hono/cors';

const app = new Hono();

// CORS für alle Routen aktivieren
app.use('*', cors());

app.get('/api/news', (c) => {
    return c.json([{id: 1, title: 'Hello from mock API (Hono)'},
        {id: 2, title: 'Another news item'},
        {id: 3, title: 'More news...'}]);
});

app.get('/api/grades', (c) => {
    return c.json([{course: 'Math', grade: '1.7'},
        {course: 'History', grade: '2.3'},
        {course: 'Science', grade: '1.3'},
        {course: 'Art', grade: '1.0'}]);
});

app.get('/', (c) => c.text('Mock API is running!'));

const port = 3000;
console.log(`Mock API running on http://localhost:${port}`);
serve({fetch: app.fetch, port});