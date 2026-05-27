import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Paths to JSON files
const DATA_DIR = path.join(__dirname, 'data');
const CONCEPTS_FILE = path.join(DATA_DIR, 'concepts.json');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');

// Ensure data folder and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CONCEPTS_FILE)) {
  fs.writeFileSync(CONCEPTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(BOARD_FILE)) {
  fs.writeFileSync(BOARD_FILE, JSON.stringify({}, null, 2));
}

// Helpers for reading/writing JSON files
const readJSON = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return filePath === BOARD_FILE ? {} : [];
  }
};

const writeJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
  }
};

// --- ENDPOINTS FOR CONCEPTS (ABM) ---

// Get all concepts
app.get('/api/concepts', (req, res) => {
  const concepts = readJSON(CONCEPTS_FILE);
  res.json(concepts);
});

// Create a new concept
app.post('/api/concepts', (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required' });
  }

  const concepts = readJSON(CONCEPTS_FILE);
  const newConcept = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name,
    color
  };

  concepts.push(newConcept);
  writeJSON(CONCEPTS_FILE, concepts);
  res.status(201).json(newConcept);
});

// Update an existing concept
app.put('/api/concepts/:id', (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required' });
  }

  const concepts = readJSON(CONCEPTS_FILE);
  const index = concepts.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Concept not found' });
  }

  concepts[index] = { ...concepts[index], name, color };
  writeJSON(CONCEPTS_FILE, concepts);
  res.json(concepts[index]);
});

// Delete a concept and clean up the board
app.delete('/api/concepts/:id', (req, res) => {
  const { id } = req.params;
  
  let concepts = readJSON(CONCEPTS_FILE);
  const conceptExists = concepts.some(c => c.id === id);
  
  if (!conceptExists) {
    return res.status(404).json({ error: 'Concept not found' });
  }

  // Filter out the deleted concept
  concepts = concepts.filter(c => c.id !== id);
  writeJSON(CONCEPTS_FILE, concepts);

  // Clean up board cells using this concept (support array values)
  const board = readJSON(BOARD_FILE);
  let boardUpdated = false;
  for (const cellKey in board) {
    if (Array.isArray(board[cellKey])) {
      const initialLength = board[cellKey].length;
      board[cellKey] = board[cellKey].filter(cid => cid !== id);
      if (board[cellKey].length !== initialLength) {
        if (board[cellKey].length === 0) {
          delete board[cellKey];
        }
        boardUpdated = true;
      }
    } else if (board[cellKey] === id) {
      delete board[cellKey];
      boardUpdated = true;
    }
  }

  if (boardUpdated) {
    writeJSON(BOARD_FILE, board);
  }

  res.json({ message: 'Concept deleted and board cleaned successfully' });
});

// --- ENDPOINTS FOR BOARD STATE ---

// Get current board cell mapping, normalizing values to arrays
app.get('/api/board', (req, res) => {
  const board = readJSON(BOARD_FILE);
  const normalized = {};
  for (const key in board) {
    if (Array.isArray(board[key])) {
      normalized[key] = board[key];
    } else if (board[key]) {
      normalized[key] = [board[key]];
    }
  }
  res.json(normalized);
});

// Add concept to a board cell array
app.post('/api/board/cell', (req, res) => {
  const { day, hour, conceptId } = req.body;
  
  if (!day || !hour || !conceptId) {
    return res.status(400).json({ error: 'Day, hour and conceptId are required' });
  }

  // Validate concept exists
  const concepts = readJSON(CONCEPTS_FILE);
  const conceptExists = concepts.some(c => c.id === conceptId);
  if (!conceptExists) {
    return res.status(404).json({ error: 'Concept not found' });
  }

  const cellKey = `${day}:${hour}`;
  const board = readJSON(BOARD_FILE);

  // Normalize to array if it doesn't exist or is a string
  if (!Array.isArray(board[cellKey])) {
    if (board[cellKey]) {
      board[cellKey] = [board[cellKey]];
    } else {
      board[cellKey] = [];
    }
  }

  board[cellKey].push(conceptId);
  writeJSON(BOARD_FILE, board);
  res.json({ cellKey, concepts: board[cellKey] });
});

// Remove concept from a board cell by index
app.post('/api/board/cell/remove', (req, res) => {
  const { day, hour, index } = req.body;
  
  if (!day || !hour || index === undefined) {
    return res.status(400).json({ error: 'Day, hour and index are required' });
  }

  const cellKey = `${day}:${hour}`;
  const board = readJSON(BOARD_FILE);

  if (board[cellKey]) {
    let list = Array.isArray(board[cellKey]) ? board[cellKey] : [board[cellKey]];
    
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
    }
    
    if (list.length === 0) {
      delete board[cellKey];
    } else {
      board[cellKey] = list;
    }
    
    writeJSON(BOARD_FILE, board);
  }

  res.json(board[cellKey] || []);
});

// Move concept from one cell to another atomically
app.post('/api/board/cell/move', (req, res) => {
  const { sourceDay, sourceHour, sourceIndex, targetDay, targetHour, conceptId } = req.body;
  
  if (!sourceDay || !sourceHour || sourceIndex === undefined || !targetDay || !targetHour || !conceptId) {
    return res.status(400).json({ error: 'Missing required parameters for move' });
  }

  const board = readJSON(BOARD_FILE);
  const sourceKey = `${sourceDay}:${sourceHour}`;
  const targetKey = `${targetDay}:${targetHour}`;

  // 1. Remove from source
  if (board[sourceKey]) {
    let sourceList = Array.isArray(board[sourceKey]) ? board[sourceKey] : [board[sourceKey]];
    if (sourceIndex >= 0 && sourceIndex < sourceList.length) {
      sourceList.splice(sourceIndex, 1);
    }
    if (sourceList.length === 0) {
      delete board[sourceKey];
    } else {
      board[sourceKey] = sourceList;
    }
  }

  // 2. Add to target
  if (!Array.isArray(board[targetKey])) {
    if (board[targetKey]) {
      board[targetKey] = [board[targetKey]];
    } else {
      board[targetKey] = [];
    }
  }
  board[targetKey].push(conceptId);

  writeJSON(BOARD_FILE, board);
  res.json({ success: true, board });
});

// Clear all board cells
app.post('/api/board/clear', (req, res) => {
  writeJSON(BOARD_FILE, {});
  res.json({ message: 'Board cleared successfully' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
