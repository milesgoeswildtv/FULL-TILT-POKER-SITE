import React from'react';
import{createRoot}from'react-dom/client';
import App from'./App.jsx';
import{installSessionRouting}from'./session.js';
import{bootstrapPlatform}from'./platform.js';
import{installPokerAudioUnlock}from'./poker-audio.js';
import'./global-royal-grade.css';
import'./telegram.css';

installPokerAudioUnlock();

const root=createRoot(document.getElementById('root'));

function render(){
 root.render(<App/>);
}

async function boot(){
 root.render(<div className="telegramBoot">Opening Crashout Poker…</div>);
 await bootstrapPlatform();
 installSessionRouting();
 addEventListener('hashchange',render);
 render();
}

boot();
