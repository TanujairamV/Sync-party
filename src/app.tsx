
declare module '*.css';

import React from 'react';
import { JamProvider } from './JamContext';
import JamMenu from './components/JamMenu';
import './styles.css';

async function main() {
  while (!Spicetify?.showNotification || !Spicetify?.Platform) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wait for either Playbar or Topbar to be available
  while (!Spicetify?.Playbar && !Spicetify?.Topbar) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Ensure sidebar exists only once
  let sidebar = document.getElementById('jam-sidebar');
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.id = 'jam-sidebar';
    document.body.appendChild(sidebar);
  }

  let isOpen = false;

  const updateBtn = () => {
    if (playbarBtn) {
        playbarBtn.active = isOpen;
    }
    // Topbar button visual toggle if needed
    if (topbarBtn && topbarBtn.element) {
        topbarBtn.element.classList.toggle('jam-topbar-btn-active', isOpen);
    }
  };

  const open  = () => { 
    isOpen = true;  
    sidebar?.classList.add('jam-sidebar-visible'); 
    updateBtn(); 
  };
  const close = () => { 
    isOpen = false; 
    sidebar?.classList.remove('jam-sidebar-visible'); 
    updateBtn(); 
  };
  const toggle = () => isOpen ? close() : open();

  const jamSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

  let playbarBtn: any = null;
  let topbarBtn: any = null;

  if (Spicetify.Playbar) {
    playbarBtn = new Spicetify.Playbar.Button(
      'Spicetify Jam',
      jamSvg,
      toggle
    );
    playbarBtn.register();
  } else if (Spicetify.Topbar) {
    topbarBtn = new (Spicetify as any).Topbar.Button(
      'Spicetify Jam',
      jamSvg,
      toggle
    );
  }

  if ((Spicetify.ReactDOM as any).createRoot) {
    (Spicetify.ReactDOM as any).createRoot(sidebar).render(
      <JamProvider>
        <JamMenu onClose={close} />
      </JamProvider>
    );
  } else {
    Spicetify.ReactDOM.render(
      <JamProvider>
        <JamMenu onClose={close} />
      </JamProvider>,
      sidebar
    );
  }
}

export default main;
