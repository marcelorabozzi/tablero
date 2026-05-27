import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Calendar, X, 
  RefreshCw, Trash, Sparkles, Palette, 
  Check, Info, Move
} from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

// Predefined premium color palette
const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#3b82f6', // Ocean Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Amethyst
  '#ec4899', // Pink
  '#6b7280'  // Slate Gray
];

const DAYS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 8;
  return h < 10 ? `0${h}:00` : `${h}:00`;
});

const getUnusedColor = (currentConcepts) => {
  const usedColors = currentConcepts.map(c => c.color.toLowerCase());
  const unusedPreset = PRESET_COLORS.find(color => !usedColors.includes(color.toLowerCase()));
  if (unusedPreset) return unusedPreset;
  
  // Generate random hex color if all preset colors are used
  let randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  while (usedColors.includes(randomColor.toLowerCase())) {
    randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  }
  return randomColor;
};

function App() {
  const [concepts, setConcepts] = useState([]);
  const [board, setBoard] = useState({});
  
  // Concept Creation Form States
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  
  // Inline Editing States
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  
  // Interaction States
  const [activeConceptId, setActiveConceptId] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Fetch initial data
  useEffect(() => {
    fetchConcepts().then(data => {
      if (data && data.length > 0) {
        setColor(getUnusedColor(data));
      }
    });
    fetchBoard();
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchConcepts = async () => {
    try {
      const res = await fetch(`${API_BASE}/concepts`);
      if (!res.ok) throw new Error('Error al cargar conceptos');
      const data = await res.json();
      setConcepts(data);
      return data;
    } catch (err) {
      showToast(err.message, 'error');
      return [];
    }
  };

  const fetchBoard = async () => {
    try {
      const res = await fetch(`${API_BASE}/board`);
      if (!res.ok) throw new Error('Error al cargar el tablero');
      const data = await res.json();
      setBoard(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- Concept Actions (CRUD) ---

  const handleCreateConcept = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('El nombre del concepto no puede estar vacío', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
      });
      if (!res.ok) throw new Error('No se pudo crear el concepto');
      showToast('Concepto creado con éxito', 'success');

      // Reset name
      setName('');
      
      // Refresh list and select first unused color
      const data = await fetchConcepts();
      setColor(getUnusedColor(data));
      fetchBoard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStartEdit = (concept) => {
    setEditingId(concept.id);
    setEditName(concept.name);
    setEditColor(concept.color);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) {
      showToast('El nombre del concepto no puede estar vacío', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/concepts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor })
      });
      if (!res.ok) throw new Error('No se pudo actualizar el concepto');
      showToast('Concepto actualizado con éxito', 'success');

      setEditingId(null);
      const data = await fetchConcepts();
      setColor(getUnusedColor(data));
      fetchBoard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteConcept = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este concepto? Se quitará de todas las celdas del tablero.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/concepts/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('No se pudo eliminar el concepto');
      
      if (activeConceptId === id) {
        setActiveConceptId(null);
      }
      
      showToast('Concepto eliminado del sistema y del tablero', 'success');
      const data = await fetchConcepts();
      setColor(getUnusedColor(data));
      fetchBoard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- Board Actions ---

  const handleCellClick = async (day, hour) => {
    // Case 1: Active concept mode is active, place the concept in this cell
    if (activeConceptId) {
      try {
        const res = await fetch(`${API_BASE}/board/cell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day, hour, conceptId: activeConceptId })
        });
        if (!res.ok) throw new Error('Error al asignar ficha');
        fetchBoard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const handleRemoveCellConcept = async (day, hour, index, e) => {
    e.stopPropagation(); // Avoid triggering cell click
    try {
      const res = await fetch(`${API_BASE}/board/cell/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, hour, index })
      });
      if (!res.ok) throw new Error('Error al quitar ficha');
      fetchBoard();
      showToast('Ficha quitada', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleClearBoard = async () => {
    if (!window.confirm('¿Seguro que deseas vaciar todo el tablero? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/board/clear`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Error al limpiar el tablero');
      fetchBoard();
      showToast('Tablero vaciado por completo', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- HTML5 Drag and Drop Handlers ---

  const handleDragStartConceptList = (e, conceptId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'from-list', conceptId }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragStartBoardCell = (e, sourceDay, sourceHour, sourceIndex, conceptId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ 
      type: 'from-board', 
      sourceDay, 
      sourceHour, 
      sourceIndex,
      conceptId 
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCell = (e, day, hour) => {
    e.preventDefault();
    setDragOverCell(`${day}:${hour}`);
  };

  const handleDragLeaveCell = () => {
    setDragOverCell(null);
  };

  const handleDropOnCell = async (e, targetDay, targetHour) => {
    e.preventDefault();
    setDragOverCell(null);
    
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;

      const data = JSON.parse(dataStr);
      
      if (data.type === 'from-list') {
        // Dragged from list to board cell
        const res = await fetch(`${API_BASE}/board/cell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: targetDay, hour: targetHour, conceptId: data.conceptId })
        });
        if (!res.ok) throw new Error('No se pudo asignar ficha');
        fetchBoard();
      } else if (data.type === 'from-board') {
        // Dragged from board cell to another board cell (atomic move)
        const { sourceDay, sourceHour, sourceIndex, conceptId } = data;
        
        // If it is the same cell, do nothing
        if (sourceDay === targetDay && sourceHour === targetHour) return;

        const moveRes = await fetch(`${API_BASE}/board/cell/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sourceDay, 
            sourceHour, 
            sourceIndex, 
            targetDay, 
            targetHour, 
            conceptId 
          })
        });
        if (!moveRes.ok) throw new Error('No se pudo mover la ficha');

        fetchBoard();
        showToast('Ficha movida con éxito', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getConceptsForCell = (day, hour) => {
    const cellKey = `${day}:${hour}`;
    const conceptIds = board[cellKey] || [];
    return conceptIds.map(cid => concepts.find(c => c.id === cid)).filter(Boolean);
  };

  const getContrastYIQ = (hexcolor) => {
    if (!hexcolor) return 'white';
    // Clean hex if needed
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#0a0e17' : '#ffffff';
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="header-title-container">
          <Calendar className="header-icon" size={32} />
          <h1>Planificador Semanal</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => { fetchConcepts(); fetchBoard(); showToast('Datos actualizados', 'info'); }}>
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button className="btn btn-danger" onClick={handleClearBoard}>
            <Trash size={16} />
            Vaciar Tablero
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="app-content">
        
        {/* Sidebar Panel for Concept Creator and Selector */}
        <aside className="sidebar">
          <div className="sidebar-title">
            <Sparkles size={20} className="header-icon" />
            <span>Nuevo Concepto</span>
          </div>

          <form onSubmit={handleCreateConcept} className="concept-form">
            <div className="form-group">
              <label htmlFor="concept-name">Nombre del concepto</label>
              <input
                id="concept-name"
                className="form-input"
                type="text"
                placeholder="Ej. Clase de Matemática"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
              />
            </div>

            <div className="form-group">
              <label>Selecciona un color</label>
              <div className="color-picker-grid">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-option ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c, color: getContrastYIQ(c) }}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={12} style={{ margin: 'auto', display: 'block' }} />}
                  </button>
                ))}
              </div>
              
              <div className="custom-color-input-wrapper">
                <Palette size={16} className="text-muted" />
                <input
                  type="color"
                  className="custom-color-picker"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="custom-color-text">{color.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                <Plus size={16} />
                Agregar
              </button>
            </div>
          </form>

          <div className="sidebar-title" style={{ marginTop: '1rem' }}>
            <Palette size={20} className="header-icon" />
            <span>Fichas Disponibles</span>
          </div>

          <div className="concept-list">
            {concepts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                No hay conceptos creados. Crea uno arriba para empezar.
              </p>
            ) : (
              concepts.map(concept => {
                const isActive = activeConceptId === concept.id;
                const isEditing = editingId === concept.id;

                if (isEditing) {
                  return (
                    <form 
                      key={concept.id}
                      className="concept-item-edit-mode"
                      onClick={e => e.stopPropagation()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveEdit(concept.id);
                      }}
                      style={{ 
                        borderLeft: `4px solid ${editColor}`,
                        padding: '1rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        borderLeftWidth: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div className="form-group">
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={40}
                          required
                          autoFocus
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`color-option ${editColor === c ? 'active' : ''}`}
                            style={{ 
                              width: '18px', 
                              height: '18px', 
                              borderRadius: '50%', 
                              backgroundColor: c, 
                              border: editColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            onClick={() => setEditColor(c)}
                          />
                        ))}
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          style={{
                            width: '18px',
                            height: '18px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={handleCancelEdit}
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          className="btn btn-primary btn-small"
                        >
                          Guardar
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={concept.id}
                    className={`concept-item ${isActive ? 'active-concept-item' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStartConceptList(e, concept.id)}
                    onClick={() => {
                      if (isActive) {
                        setActiveConceptId(null);
                      } else {
                        setActiveConceptId(concept.id);
                        showToast(`Modo colocación activo para: ${concept.name}. Haz clic en las celdas del tablero para colocar la ficha.`, 'info');
                      }
                    }}
                    style={{
                      borderLeft: `4px solid ${concept.color}`,
                      backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : '',
                      borderColor: isActive ? 'var(--accent-color)' : ''
                    }}
                    title="Arrastra esta ficha al tablero, o haz clic para activarla y colocarla con clics"
                  >
                    <div className="concept-info">
                      <div 
                        className="concept-color-indicator" 
                        style={{ backgroundColor: concept.color, color: concept.color }}
                      />
                      <span className="concept-name">{concept.name}</span>
                    </div>
                    <div className="concept-item-actions" onClick={e => e.stopPropagation()}>
                      <button 
                        className="icon-btn" 
                        onClick={() => handleStartEdit(concept)}
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        className="icon-btn icon-btn-danger" 
                        onClick={() => handleDeleteConcept(concept.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Board Planner Area */}
        <section className="board-container">
          
          <div className="toolbar">
            <div className="toolbar-info">
              <Info size={16} className="header-icon" />
              <span>
                {activeConceptId 
                  ? 'Haz clic en una celda vacía para colocar la ficha activa, o haz clic en su X para quitarla.' 
                  : 'Arrastra fichas del lateral al tablero, o haz clic en una para colocarla con clics. ¡También puedes arrastrar fichas entre celdas!'}
              </span>
            </div>
            
            {activeConceptId && (
              (() => {
                const activeConcept = concepts.find(c => c.id === activeConceptId);
                return activeConcept ? (
                  <div 
                    className="active-concept-badge"
                    style={{ backgroundColor: activeConcept.color, color: getContrastYIQ(activeConcept.color) }}
                  >
                    <span>Colocando: {activeConcept.name}</span>
                    <X 
                      size={14} 
                      className="active-concept-clear" 
                      onClick={() => setActiveConceptId(null)}
                    />
                  </div>
                ) : null;
              })()
            )}
          </div>

          {/* Grid Header */}
          <div className="board-header-row">
            <div className="board-header-cell hour-header">Hora</div>
            {DAYS.map(day => (
              <div key={day} className="board-header-cell">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="board-grid">
            {HOURS.map(hour => (
              <div key={hour} className="board-row">
                {/* Hour indicator column */}
                <div className="hour-cell">{hour}</div>
                
                {/* Days columns */}
                {DAYS.map(day => {
                  const cellConcepts = getConceptsForCell(day, hour);
                  const cellKey = `${day}:${hour}`;
                  const isDragOver = dragOverCell === cellKey;
                  
                  return (
                    <div
                      key={day}
                      className={`grid-cell ${isDragOver ? 'drag-over' : ''} ${activeConceptId ? 'cell-selection-mode' : ''}`}
                      onDragOver={(e) => handleDragOverCell(e, day, hour)}
                      onDragLeave={handleDragLeaveCell}
                      onDrop={(e) => handleDropOnCell(e, day, hour)}
                      onClick={() => handleCellClick(day, hour)}
                      title={cellConcepts.length > 0 ? `${cellConcepts.map(c => c.name).join(', ')} a las ${hour}` : `Vacío - ${day} ${hour}`}
                    >
                      {cellConcepts.map((concept, index) => (
                        <div
                          key={`${concept.id}-${index}`}
                          className="token-card"
                          draggable
                          onDragStart={(e) => handleDragStartBoardCell(e, day, hour, index, concept.id)}
                          style={{ 
                            backgroundColor: concept.color, 
                            color: getContrastYIQ(concept.color) 
                          }}
                        >
                          <div className="token-card-header">
                            <span className="token-name" title={concept.name}>{concept.name}</span>
                            <button 
                              className="token-clear-btn"
                              onClick={(e) => handleRemoveCellConcept(day, hour, index, e)}
                              title="Quitar ficha de esta celda"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', opacity: 0.7 }}>
                            <Move size={10} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Notifications Toast */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
