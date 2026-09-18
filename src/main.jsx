import React from'react';
import{createRoot}from'react-dom/client';
import App from'./App.jsx';
import TournamentConfig from'./TournamentConfig.jsx';
import{installSessionRouting}from'./session.js';
import{bootstrapPlatform}from'./platform.js';
import'./tournament-config.css';
import'./global-royal-grade.css';
import'./telegram.css';

const root=createRoot(document.getElementById('root'));

function render(){
 root.render(<><App/><TournamentConfig/></>);
}

async function boot(){
 root.render(<div className="telegramBoot">Opening Crashout Poker…</div>);
 await bootstrapPlatform();
 installSessionRouting();
 addEventListener('hashchange',render);
 render();
}

boot();
