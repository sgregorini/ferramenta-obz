import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db.js';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota para cadastrar nova área
app.post('/areas', async (req, res) => {
  const { nome, responsavel, cor } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO areas (nome, responsavel, cor) VALUES ($1, $2, $3) RETURNING *',
      [nome, responsavel, cor]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar área:', error);
    res.status(500).json({ erro: 'Erro ao salvar área' });
  }
});

// Rota para listar áreas
app.get('/areas', async (req, res) => {
  try {
    console.log("ANTES DO SELECT");
    const result = await db.query('SELECT * FROM areas ORDER BY id');
    console.log("RESULTADO:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.log("ENTROU NO CATCH");
    console.error('ERRO REAL AO BUSCAR ÁREAS:', error);
    res.status(500).json({ erro: 'Erro ao buscar áreas' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
