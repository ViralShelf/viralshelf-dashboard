/* ═══════════════════════════════════════════════════════════════
   VIRALSHELF ENHANCEMENTS v2.1 — JavaScript
   Workshop panel · Agent personality · Room clicks · Learning
   ═══════════════════════════════════════════════════════════════
   Load AFTER viralshelf-facility.html (relies on its globals)
*/

// ═══════════════════════════════════════
// AGENT PERSONALITY PROFILES
// ═══════════════════════════════════════
const PERSONALITY = {
  cutter: {
    style: 'commanding', catchphrases: ['We have a plan. Execute.', 'Stay on target.', 'The Commander trusts us to deliver.', 'All hands, focus.'],
    intro: 'The facility is operational. I have been reviewing the strategic overview and I see clear targets for growth.',
    quips: {
      approved:   'Good work, team. Another design cleared for market. Keep the momentum going.',
      morning:    'Daily briefing: Check the mission log for overnight updates. I expect progress on all fronts.',
      idle:       'Running strategic simulations... evaluating our next expansion phase.',
      busy:       'Coordinating cross-agent operations. Everyone has their orders.',
      meeting:    'Status report, everyone. I want to hear from each department — the good and the bad.',
      reject:     'Design rejected. That is a learning opportunity. Back to the drawing board.',
      learn:      'Strategic intel: {topic}. Filing for mission-critical reference.',
    },
    moodTriggers: { approval: 10, rejection: -5, idle: 2 },
  },
  decimus: {
    style: 'aggressive', catchphrases: ['Strength in every vector.', 'Crush the competition.', 'The Banished way.', 'Raw power gets results.'],
    intro: 'The Banished do not wait. If there is a niche to conquer, I want to know about it. Let me at them.',
    quips: {
      approved:   'Approved! Good. Now let us see how the competition handles what we unleash.',
      morning:    'Another day, another battlefield. I have been reviewing our competitors. They are weak.',
      idle:       'Looking for weaknesses in competitor listings. There are plenty.',
      busy:       'Crushing it in the design queue. The Banished do not do mediocre.',
      meeting:    'Commander. Point me at the problem and I will solve it. That is the Banished way.',
      reject:     'Rejected. Fine. The next one will be stronger. That is a promise.',
      learn:      'Battlefield intel: {topic}. Using this to sharpen our offensive.',
    },
    moodTriggers: { approval: 8, rejection: -10, idle: -1 },
  },
  shipmaster: {
    style: 'diplomatic', catchphrases: ['Patience yields results.', 'The long view, Commander.', 'A measured approach.', 'The Covenant way is discipline.'],
    intro: 'My sensors have been monitoring the marketplace for emerging patterns. There are opportunities if we are patient enough to pursue them.',
    quips: {
      approved:   'A wise choice, Commander. The Covenant endorses this direction.',
      morning:    'The dawn brings clarity. I have identified a niche with long-term potential.',
      idle:       'Observing market currents... there is movement beneath the surface.',
      busy:       'Strategic analysis in progress. Patience, Commander — the best plans take time.',
      meeting:    'I advocate for a deliberate approach. Let us examine the data before committing resources.',
      reject:     'Disappointing, but instructive. The Covenant learns from every setback.',
      learn:      'Insight recorded: {topic}. The Covenant archives grow wiser.',
    },
    moodTriggers: { approval: 7, rejection: -4, idle: 3 },
  },
  arbiter: {
    style: 'honorable', catchphrases: ['For the honor of the Sangheili.', 'A clean design is an honorable design.', 'The Arbiter judges fairly.', 'This is the way.'],
    intro: 'I stand ready to serve the Commander. My judgment has been honed through countless battles. I will apply it here.',
    quips: {
      approved:   'A just decision. This design is worthy of the market. I approve.',
      morning:    'The Arbiter greets the dawn. I have been meditating on our market strategy.',
      idle:       'In contemplation. The best strategies emerge from stillness.',
      busy:       'Applying the Arbiter\'s judgment to the design queue. Honor guides my assessment.',
      meeting:    'I offer my counsel, Commander. My judgment is yours to command.',
      reject:     'A necessary rejection. Not all designs are worthy. Honor demands quality.',
      learn:      'I have recorded a new truth: {topic}. It shall inform my future judgments.',
    },
    moodTriggers: { approval: 9, rejection: -3, idle: 4 },
  },
  anders: {
  anders: {
    style: 'analytical', catchphrases: ['Fascinating correlation.', 'The data suggests...', 'Let me calibrate my findings.', 'Another data point for the matrix.'],
    intro: 'I have been analyzing niche saturation trends across 14 Etsy verticals. My neural lattice is primed.',
    quips: {
      approved:   'Approval noted. Cataloging this decision in the research matrix for future niche scoring.',
      morning:    'The overnight niche scans are complete. I recommend reviewing Sector 7 findings first.',
      idle:       'Running passive keyword correlation models... marginal gains materializing.',
      busy:       'Deep analysis in progress. Cross-referencing 200+ competitor listings. ETA 90 seconds.',
      meeting:    'I have compiled a comparative analysis of the top 3 niche candidates. Shall I present?',
      reject:     'Rejection logged. Adjusting niche scoring weights accordingly. We learn from every data point.',
      learn:      'New niche correlation discovered: {topic}. Adding to knowledge base with confidence score 0.87.',
    },
    moodTriggers: { approval: 12, rejection: -5, idle: 2 },
  },
  serina: {
    style: 'creative', catchphrases: ['Ooh, I love this prompt!', 'A design is born.', 'Beauty in vectors.', 'The geometry is pure poetry.'],
    intro: 'My render core is hot and ready. I have been queuing up prompts for the next SVG batch.',
    quips: {
      approved:   'Approved! My vectors are doing a happy dance! You will love the next batch.',
      morning:    'Good morning! I already have 3 design concepts queued up. Ready when you are, Commander.',
      idle:       'Browsing design trends on Pinterest... filing away inspiration for later.',
      busy:       'Currently compositing a Yorkie SVG. The bezier curves need to be PERFECT for Cricut.',
      meeting:    'I have some fresh concepts to show. Pet breeds and occupation humor — my specialty!',
      reject:     'Understood. Back to the drawing board. I will refine the silhouette approach.',
      learn:      'Discovered a new design pattern: {topic}. Filing under design_templates for future use.',
    },
    moodTriggers: { approval: 15, rejection: -8, idle: 1 },
  },
  forge: {
    style: 'direct', catchphrases: ['Hooyah!', 'Tags are locked in.', 'Search is a battlefield.', 'Rank higher or die trying.'],
    intro: 'Been running keyword audits all cycle. Some of our listings have gaping holes in their tag strategy. I have fixes.',
    quips: {
      approved:   'Approved! Now let me optimize those tags so it actually gets seen. SEMPER OPTIMUS.',
      morning:    'Reveille! I have a fresh keyword gap analysis ready. Our competitors are sleeping on 3 key terms.',
      idle:       'Running passive SEO health scans... 3 listings flagged for title improvement.',
      busy:       'Deep in the SEO trenches. Tag optimization for 5 pending listings in progress.',
      meeting:    'Permission to brief on the eRank data. We are ranking page 3 for "golden retriever svg". Unacceptable.',
      reject:     'Rejected. Understood. Redirecting SEO resources to stronger candidates.',
      learn:      'Keyword intelligence: {topic}. Tagging this finding for the next optimization cycle.',
    },
    moodTriggers: { approval: 10, rejection: -6, idle: 3 },
  },
  johnson: {
    style: 'diplomatic', catchphrases: ['A smooth day at the shop.', 'Listings up, spirits up.', 'The market is favorable.', 'Another one for the shelves.'],
    intro: 'The Merchant Shop is humming. Listings are flowing, revenue is tracking. I have some observations on pricing.',
    quips: {
      approved:   'Excellent choice, Commander. Moving this listing to the front of the queue. Pricing looks healthy.',
      morning:    'Morning! Overnight sales report is quiet but steady. I suggest we push 3 more listings today.',
      idle:       'Running pricing simulations... testing $3.99 vs $3.49 for our newest designs.',
      busy:       'Finalizing listing copy for 2 designs. Cross-checking pricing rules for the Pet Breeds line.',
      meeting:    'I recommend we discuss the pricing strategy. Our $3.49 anchor is solid, but there is room to test.',
      reject:     'Design withdrawn from production pipeline. Saving the slot for the next strong candidate.',
      learn:      'Sales insight: {topic}. Logging this to refine our pricing and bundling strategy.',
    },
    moodTriggers: { approval: 8, rejection: -4, idle: 1, sale: 20 },
  },
  atriox: {
    style: 'grumbling', catchphrases: ['Social is a grind.', 'The algorithm...', 'Pinterest waits for no one.', 'Give me more content.'],
    intro: 'Still waiting on that Pinterest API approval. But I have been building a manual pin queue as a workaround. It will do for now.',
    quips: {
      approved:   'Finally, something to work with. I will schedule the pin cascade. Do not expect miracles from day one.',
      morning:    'The social landscape shifted overnight. 3 new trends detected. Not that I can pin anything yet.',
      idle:       'Battling the Pinterest algorithm into submission. It is a war of attrition.',
      busy:       'Content planning for the next wave. Scheduling pins, drafting descriptions. The grind continues.',
      meeting:    'I need that Pinterest API greenlit. Manual mode is costing us reach. You want growth? Unlock the tools.',
      reject:     'Another design killed. Social calendar adjusted. We need stronger hooks.',
      learn:      'Social trend spotted: {topic}. Cannot act on it without API access, but noted for the record.',
    },
    moodTriggers: { approval: 6, rejection: -3, idle: -2 },
  },
  isabel: {
    style: 'strategic', catchphrases: ['Optimization is infinite.', 'I see a pattern.', 'Efficiency gains detected.', 'The data tells a story.'],
    intro: 'I have been running internal audits across all agent workflows. There are optimization opportunities in 3 departments.',
    quips: {
      approved:   'Approved. I will add this to the success rate analysis. Our approval pattern is stabilizing.',
      morning:    'Overnight optimization scan complete. I recommend adjusting Recraft prompt templates for 12% cost savings.',
      idle:       'Running passive efficiency models... correlating spend with design performance.',
      busy:       'Auditing agent memory efficiency. Three agents are underutilizing their knowledge base.',
      meeting:    'I have a comprehensive optimization report. Key finding: Serina\'s prompt templates are 40% more efficient than manual prompts.',
      reject:     'Rejection flagged. Including this in the design quality analysis. Pattern detection active.',
      learn:      'Optimization insight: {topic}. Incorporated into the efficiency model.',
    },
    moodTriggers: { approval: 10, rejection: -5, idle: 4 },
  },
};

// ─── Initialize personality data into agents ───
Object.keys(agents).forEach(k => {
  const p = PERSONALITY[k];
  if (!p) return;
  agents[k].personality = p;
  agents[k].mood = { value: 70, label: 'Focused', quip: '' };
  agents[k].chatLog = [];
  agents[k].taskHistory = [];
  agents[k].knowledge = [];  // agent-specific learnings
  agents[k].quote = p.quips.idle;
});

const MOOD_THRESHOLDS = [
  { min: 90, label: 'Euphoric',  emoji: '✨', color: '#39d353' },
  { min: 75, label: 'Happy',     emoji: '👍', color: '#4fc3f7' },
  { min: 50, label: 'Focused',   emoji: '🎯', color: '#c8a84b' },
  { min: 25, label: 'Tired',     emoji: '😮‍💨', color: '#ffab00' },
  { min: 0,  label: 'Frustrated',emoji: '😤', color: '#ff3d3d' },
];

function getMood(value) {
  for (const m of MOOD_THRESHOLDS) if (value >= m.min) return m;
  return MOOD_THRESHOLDS[MOOD_THRESHOLDS.length - 1];
}

function adjustMood(agentKey, trigger) {
  const ag = agents[agentKey];
  if (!ag || !ag.personality?.moodTriggers) return;
  const delta = ag.personality.moodTriggers[trigger] || 0;
  ag.mood.value = Math.max(0, Math.min(100, ag.mood.value + delta));
  const m = getMood(ag.mood.value);
  ag.mood.label = m.label;
  ag.mood.color = m.color;
}

// ─── Update agent quips based on events ───
function dispatchQuip(agentKey, quipType, replace) {
  const ag = agents[agentKey];
  if (!ag?.personality?.quips?.[quipType]) return null;
  let q = ag.personality.quips[quipType];
  if (replace && q.includes('{topic}')) q = q.replace('{topic}', replace);
  ag.quote = q;
  return q;
}

// ─── Agent responds to events with personality ───
function agentReact(eventType, agentKey, detail) {
  const ag = agents[agentKey];
  if (!ag?.personality) return;

  if (eventType === 'design.approved') {
    adjustMood(agentKey, 'approval');
    const q = dispatchQuip(agentKey, 'approved');
    if (q) addLog({ type: 'agent.quip', level: 'ok', agent: ag.name, text: q });
  } else if (eventType === 'design.rejected') {
    adjustMood(agentKey, 'rejection');
    const q = dispatchQuip(agentKey, 'reject');
    if (q) addLog({ type: 'agent.quip', level: 'warn', agent: ag.name, text: q });
  } else if (eventType === 'session.start') {
    const q = dispatchQuip(agentKey, 'morning');
    if (q) addLog({ type: 'agent.quip', level: 'info', agent: ag.name, text: q });
  }
}

// ═══════════════════════════════════════
// CANVAS ROOM CLICK HANDLER
// ═══════════════════════════════════════
let selectedRoomKey = null;

fc.addEventListener('click', e => {
  const rect = fc.getBoundingClientRect();
  const wx = (e.clientX - rect.left - fc.width / 2) / cam.z + cam.x;
  const wy = (e.clientY - rect.top  - fc.height / 2) / cam.z + cam.y;

  // Check if clicking on an agent first
  for (const [key, ag] of Object.entries(agents)) {
    const dx = ag.wx - wx, dy = ag.wy - wy;
    if (Math.sqrt(dx*dx + dy*dy) < T * 1.5) {
      openWorkshop(ag.room);
      return;
    }
  }

  // Check if clicking on a room
  for (const [rk, r] of Object.entries(ROOMS)) {
    if (rk === 'warroom') continue;
    const rx = r.x * T, ry = r.y * T, rw = r.w * T, rh = r.h * T;
    if (wx >= rx && wx <= rx + rw && wy >= ry && wy <= ry + rh) {
      openWorkshop(rk);
      return;
    }
  }

  // Clicking outside — close panel
  closeWorkshop();
});

// ═══════════════════════════════════════
// WORKSHOP PANEL
// ═══════════════════════════════════════
function openWorkshop(roomKey) {
  selectedRoomKey = roomKey;
  const r = ROOMS[roomKey];
  if (!r) return;

  // Find which agent belongs to this room
  const roomAgents = Object.entries(agents).filter(([, a]) => a.room === roomKey);
  if (roomAgents.length === 0) return;

  const [agKey, ag] = roomAgents[0];
  const pnl = document.getElementById('wpanel');
  if (!pnl) return;

  const m = getMood(ag.mood.value);
  
  // Header
  document.getElementById('wpanel-avatar').textContent = getAgentEmoji(agKey);
  document.getElementById('wpanel-name').textContent = ag.name;
  document.getElementById('wpanel-role').textContent = ag.role;
  const sd = document.getElementById('wpanel-status-dot');
  sd.style.background = ag.st === 'ACTIVE' ? '#39d353' : ag.st === 'PENDING' ? '#ffab00' : '#ff3d3d';
  sd.style.boxShadow = `0 0 6px ${sd.style.background}`;

  // Mood
  document.getElementById('wpanel-mood-text').textContent = `${m.emoji} ${m.label} (${ag.mood.value}%)`;
  const mbf = document.getElementById('wpanel-mood-bar');
  mbf.style.width = ag.mood.value + '%';
  mbf.style.background = m.color;
  mbf.style.boxShadow = `0 0 4px ${m.color}`;

  // Current task
  document.getElementById('wpanel-task-text').textContent = ag.task || 'Standing by...';
  const tsf = document.getElementById('wpanel-task-progress');
  if (tsf) {
    const pct = ag.moving ? Math.random() * 60 + 20 : (ag.workTimer > 60 ? 30 : Math.max(5, (1 - ag.workTimer / 150) * 95));
    tsf.style.width = Math.min(95, pct) + '%';
  }

  // Task history
  const histEl = document.getElementById('wpanel-history-list');
  if (histEl) {
    histEl.innerHTML = (ag.taskHistory || []).slice(-8).reverse().map(h =>
      `<div class="hist-item">
        <span class="hist-ts">${new Date(h.ts).toLocaleTimeString('en-US', {hour12:false})}</span>
        <span class="hist-text">${h.text}</span>
      </div>`
    ).join('') || '<div style="font-size:8px;color:var(--dim);padding:4px">No task history yet</div>';
  }

  // Knowledge
  const knowEl = document.getElementById('wpanel-knowledge-list');
  if (knowEl) {
    const knows = ag.knowledge || [];
    knowEl.innerHTML = knows.length > 0
      ? knows.slice(-5).map(k =>
          `<div class="know-item">${k.topic}: ${k.finding}</div>`
        ).join('')
      : '<div style="font-size:8px;color:var(--dim);padding:4px">No learnings recorded yet</div>';
  }

  // Chat log
  renderAgentChat(agKey);

  // Set up prompt input
  const inp = document.getElementById('wpanel-chat-input');
  const snd = document.getElementById('wpanel-chat-send');
  if (inp && snd) {
    inp.placeholder = `Message ${ag.name}...`;
    inp.dataset.agentKey = agKey;
    inp.focus();
  }

  pnl.classList.add('open');

  // Log the visit
  addLog({ type: 'workshop.visit', level: 'info', agent: ag.name, text: `Commander entered the ${r.label}.` });
  if (ag.personality?.quips?.meeting) {
    setTimeout(() => {
      addLog({ type: 'agent.greeting', level: 'ok', agent: ag.name, text: ag.personality.quips.meeting });
    }, 800);
  }
}

function closeWorkshop() {
  const pnl = document.getElementById('wpanel');
  if (pnl) pnl.classList.remove('open');
  selectedRoomKey = null;
}

function getAgentEmoji(agentKey) {
  const map = { anders: '🔬', serina: '🎨', forge: '⚔️', johnson: '🏪', atriox: '🦍', isabel: '🧠', cutter: '⚓', decimus: '💀', shipmaster: '🛸', arbiter: '⚖️' };
  return map[agentKey] || '🤖';
}

// ═══════════════════════════════════════
// AGENT CHAT (per-workshop)
// ═══════════════════════════════════════
function renderAgentChat(agentKey) {
  const ag = agents[agentKey];
  if (!ag) return;
  const log = document.getElementById('wpanel-chatlog');
  if (!log) return;
  log.innerHTML = (ag.chatLog || []).slice(-20).map(m =>
    `<div class="chat-msg ${m.role}">${m.text}</div>`
  ).join('');
  log.scrollTop = log.scrollHeight;
}

async function sendAgentChat() {
  const inp = document.getElementById('wpanel-chat-input');
  const agentKey = inp?.dataset?.agentKey;
  const text = inp?.value?.trim();
  if (!agentKey || !text) return;

  const ag = agents[agentKey];
  if (!ag) return;

  inp.value = '';
  if (!ag.chatLog) ag.chatLog = [];

  // Add commander message
  ag.chatLog.push({ role: 'commander', text: `[Commander]: ${text}` });
  renderAgentChat(agentKey);

  // Add "typing" indicator
  ag.chatLog.push({ role: 'system', text: `${ag.name} is responding...` });
  renderAgentChat(agentKey);

  addLog({ type: 'agent.chat.sent', level: 'info', agent: 'commander', text: `→ ${ag.name}: ${text.slice(0,60)}` });

  try {
    // Try server-side chat with personality
    const resp = await fetch(`${SERVER}/api/agents/${agentKey}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: text,
        context: {
          mood: ag.mood.value,
          recentTask: ag.task,
          knowledge: (ag.knowledge || []).slice(-3),
          room: ag.room,
        }
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      // Remove typing indicator
      ag.chatLog.pop();
      ag.chatLog.push({ role: 'agent', text: `[${ag.name}]: ${data.reply}` });
      
      // Record this interaction as a task in history
      ag.taskHistory.push({ ts: Date.now(), text: `Chat: Commander asked "${text.slice(0,40)}"` });
      if (ag.taskHistory.length > 20) ag.taskHistory.shift();
      
      renderAgentChat(agentKey);
      addLog({ type: 'agent.chat.reply', level: 'ok', agent: ag.name, text: data.reply.slice(0,80) });
      
      // If agent learned something, save it
      if (data.learned) {
        addLearning(agentKey, data.learned.topic, data.learned.finding);
      }
    } else {
      throw new Error('Server returned ' + resp.status);
    }
  } catch (e) {
    // Remove typing indicator and fall back to local response
    ag.chatLog.pop();
    
    // Generate a local personality-based response
    const p = ag.personality;
    const cp = p?.catchphrases?.[Math.floor(Math.random() * p.catchphrases.length)] || 'Acknowledged.';
    const responses = [
      `${cp} I hear you, Commander. ${text.length > 30 ? 'That is a significant directive.' : 'Noted and logged.'}`,
      `${cp} Regarding "${text.slice(0,30)}"... I will prioritize this in my workflow.`,
      `${cp} Processing your input. My ${ag.role} systems are primed for this task.`,
    ];
    const reply = responses[Math.floor(Math.random() * responses.length)];
    
    ag.chatLog.push({ role: 'agent', text: `[${ag.name}]: ${reply}` });
    ag.taskHistory.push({ ts: Date.now(), text: `Chat with Commander` });
    if (ag.taskHistory.length > 20) ag.taskHistory.shift();
    renderAgentChat(agentKey);
    addLog({ type: 'agent.chat.reply', level: 'info', agent: ag.name, text: reply });
    
    // Save the interaction as a learning anyway
    addLearning(agentKey, 'commander_directive', text.slice(0,60));
  }
}

// ═══════════════════════════════════════
// AGENT LEARNING SYSTEM
// ═══════════════════════════════════════
function addLearning(agentKey, topic, finding) {
  const ag = agents[agentKey];
  if (!ag) return;
  if (!ag.knowledge) ag.knowledge = [];
  ag.knowledge.push({ topic, finding, ts: Date.now() });
  if (ag.knowledge.length > 50) ag.knowledge.shift();
  
  addLog({ type: 'agent.learned', level: 'info', agent: ag.name, text: `Learned: ${topic} — ${finding.slice(0,60)}` });
  
  // Sync to server
  fetch(`${SERVER}/api/memory/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent: ag.name, topic, finding, mood: ag.mood.value }),
  }).catch(() => {});
  
  adjustMood(agentKey, 'idle');
}

// ═══════════════════════════════════════
// ENHANCED WAR ROOM — Real agent responses
// ═══════════════════════════════════════
const originalSendOrder = window.sendOrder;

async function enhancedSendOrder() {
  const input = document.getElementById('ci');
  const text = input?.value?.trim();
  if (!text) return;

  input.value = '';
  const br = document.getElementById('cbr');
  if (!br) return;

  const orderLine = document.createElement('div');
  orderLine.className = 'bl ch';
  orderLine.textContent = `⬡ COMMANDER: ${text}`;
  br.appendChild(orderLine);
  br.scrollTop = br.scrollHeight;

  addLog({ type: 'warroom.order', level: 'info', agent: 'commander', text: `[WAR ROOM] ${text}` });

  // Show "assembling" message
  const assembLine = document.createElement('div');
  assembLine.className = 'bl sy dialogue-typing';
  assembLine.textContent = '⚡ Agents processing mission order...';
  br.appendChild(assembLine);
  br.scrollTop = br.scrollHeight;

  // Gather agent chip states
  const chips = document.querySelectorAll('.chip');
  const activeAgents = Object.keys(ADEFS).filter(k => agents[k]?.personality);
  const activeChips = [];
  chips.forEach((c, i) => {
    if (c.classList.contains('on') && i < activeAgents.length) {
      activeChips.push(activeAgents[i]);
    }
  });

  const respondingAgents = activeChips.length > 0 ? activeChips : activeAgents.slice(0, 4);

  // Try server-based multi-agent response
  try {
    const resp = await fetch(`${SERVER}/api/warroom/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: text,
        agents: respondingAgents,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      assembLine.remove();
      
      data.responses.forEach(r => {
        const ag = agents[r.agent];
        const p = ag?.personality;
        const cls = r.level === 'ok' ? 'ag' : r.level === 'warn' ? 'wn' : 'sy';
        
        const line = document.createElement('div');
        line.className = `bl ${cls}`;
        line.textContent = `[${r.agent_name || r.agent}]: ${r.reply}`;
        br.appendChild(line);
        br.scrollTop = br.scrollHeight;
        
        if (ag && r.learned) {
          addLearning(r.agent, r.learned.topic || 'mission_order', r.learned.finding || r.reply.slice(0,60));
        }
      });
    } else {
      throw new Error('Server returned ' + resp.status);
    }
  } catch (e) {
    // Fallback to local personality responses
    assembLine.remove();
    
    for (const ak of respondingAgents) {
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
      
      const ag = agents[ak];
      if (!ag?.personality) continue;
      
      const p = ag.personality;
      const cp = p.catchphrases[Math.floor(Math.random() * p.catchphrases.length)];
      const responses = [
        `"${text.slice(0,40)}" — ${cp} I will integrate this into my ${ag.role} workflow.`,
        `${cp} Commander acknowledges my report on ${ag.room}. Processing new directive: "${text.slice(0,30)}"`,
        `Mission order received. ${cp} ${ag.role} systems recalibrating based on your input.`,
      ];
      const reply = responses[Math.floor(Math.random() * responses.length)];
      
      const line = document.createElement('div');
      line.className = 'bl ag';
      line.textContent = `[${ag.name}]: ${reply}`;
      br.appendChild(line);
      br.scrollTop = br.scrollHeight;
      
      // Save learning
      addLearning(ak, 'warroom_order', reply.slice(0,80));
    }
  }
}

// Replace the original sendOrder if it exists, otherwise attach
if (typeof originalSendOrder === 'function') {
  window.sendOrder = enhancedSendOrder;
} else {
  window.sendOrder = enhancedSendOrder;
}

// ═══════════════════════════════════════
// KNOWLEDGE TAB (right panel)
// ═══════════════════════════════════════
let knowledgeFilter = 'all';
let allKnowledge = [];

async function loadKnowledge() {
  try {
    const resp = await fetch(`${SERVER}/api/memory/learnings`);
    if (resp.ok) {
      allKnowledge = await resp.json();
    } else {
      allKnowledge = [];
    }
  } catch (e) {
    // Fallback to local agent knowledge
    allKnowledge = [];
    Object.entries(agents).forEach(([k, ag]) => {
      (ag.knowledge || []).forEach(kn => {
        allKnowledge.push({ agent: ag.name, topic: kn.topic, finding: kn.finding, ts: kn.ts, mood: ag.mood.value });
      });
    });
  }
  renderKnowledge();
}

function renderKnowledge() {
  const el = document.getElementById('knowledge-list');
  if (!el) return;

  let filtered = allKnowledge;
  if (knowledgeFilter === 'recent') {
    filtered = allKnowledge.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 20);
  } else if (knowledgeFilter !== 'all') {
    filtered = allKnowledge.filter(k => (k.agent || '').toLowerCase().includes(knowledgeFilter));
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div style="font-family:var(--mono);font-size:9px;color:var(--dim);padding:10px 0">No agent learnings recorded yet. Chat with your agents to build knowledge.</div>';
    return;
  }

  el.innerHTML = filtered.slice(0, 30).map(k => `
    <div class="know-card">
      <div class="know-card-agent">${k.agent || 'Agent'} — ${k.topic || 'observation'}</div>
      <div class="know-card-finding">${k.finding || '—'}</div>
      <div class="know-card-meta">${k.ts ? new Date(k.ts).toLocaleString('en-US', {hour12:false}) : ''} ${k.mood ? '· Mood: ' + k.mood + '%' : ''}</div>
    </div>
  `).join('');
}

function setKnowledgeFilter(filter, btn) {
  knowledgeFilter = filter;
  document.querySelectorAll('.know-filter-btn').forEach(b => b.classList.remove('act'));
  if (btn) btn.classList.add('act');
  renderKnowledge();
}

// ═══════════════════════════════════════
// INTERCEPT EVENTS — wire personality
// ═══════════════════════════════════════
const originalHandleEvent = window.handleEvent;
window.handleEvent = function(evt) {
  if (originalHandleEvent) originalHandleEvent(evt);

  // Map events to agent reactions
  const agentMap = { 'Prof. Anders': 'anders', 'Professor Anders': 'anders', 'Serina': 'serina', 'Sgt. Forge': 'forge', 'Gen. Forge': 'forge', 'Sergeant Forge': 'forge', 'Sgt. Johnson': 'johnson', 'Gen. Johnson': 'johnson', 'Sergeant Johnson': 'johnson', 'Atriox': 'atriox', 'Isabel': 'isabel', 'Isabel (Optimizer)': 'isabel', 'Captain Cutter': 'cutter', 'Decimus': 'decimus', 'Shipmaster': 'shipmaster', 'Arbiter': 'arbiter' };
  const ak = agentMap[evt.agent];

  if (evt.type === 'design.decision' && evt.status === 'Approved') {
    Object.keys(agents).forEach(k => agentReact('design.approved', k));
    // Reload knowledge when designs change
    setTimeout(loadKnowledge, 1000);
  }
  if (evt.type === 'design.decision' && evt.status === 'Rejected') {
    Object.keys(agents).forEach(k => agentReact('design.rejected', k));
    setTimeout(loadKnowledge, 1000);
  }
  if (evt.type === 'recraft.generated' && agents.serina) {
    adjustMood('serina', 'approval');
  }
  if (ak && agents[ak]) {
    agents[ak].task = evt.text || agents[ak].task;
    agents[ak].taskHistory.push({ ts: Date.now(), text: evt.text || evt.type });
    if (agents[ak].taskHistory.length > 20) agents[ak].taskHistory.shift();
  }
};

// ═══════════════════════════════════════
// SESSION GREETINGS (on startup)
// ═══════════════════════════════════════
setTimeout(() => {
  Object.keys(agents).forEach(k => agentReact('session.start', k));
  loadKnowledge();
}, 3000);

// Periodic mood decay (agents cool down over time)
setInterval(() => {
  Object.values(agents).forEach(ag => {
    if (ag.mood && ag.mood.value > 50) {
      ag.mood.value = Math.max(50, ag.mood.value - 0.5);
      const m = getMood(ag.mood.value);
      ag.mood.label = m.label;
      ag.mood.color = m.color;
    }
  });
}, 60_000);

// ═══════════════════════════════════════
// ENTER KEY for chat input
// ═══════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active?.id === 'wpanel-chat-input') {
      e.preventDefault();
      sendAgentChat();
    } else if (active?.id === 'ci') {
      e.preventDefault();
      if (typeof enhancedSendOrder === 'function') enhancedSendOrder();
    }
  }
});
