
import React from 'react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  username: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, username }) => {
  const teamTag = "KC";
  const avatarGif = "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Zic3B6bmx6Ynh6Ynh6Ynh6Ynh6Ynh6Ynh6Ynh6Ynh6Ynh6Ynh6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/v9G3NGByE9x16/giphy.gif";

  const menuItems = [
    { id: 'jornal', label: 'Jornal', icon: 'fa-solid fa-newspaper' },
    { id: 'deck', label: 'Deck', icon: 'fa-solid fa-box-archive' },
    { id: 'minha-conta', label: 'Minha Conta', icon: 'fa-solid fa-user-gear' },
    { id: 'missões', label: 'Missões', icon: 'fa-solid fa-scroll' },
    { id: 'status', label: 'Status', icon: 'fa-solid fa-gauge-high' },
    { id: 'amigos', label: 'Amigos', icon: 'fa-solid fa-user-group' },
    { id: 'mensagens', label: 'Mensagens', icon: 'fa-solid fa-envelope' },
    { id: 'inventário', label: 'Inventário', icon: 'fa-solid fa-briefcase' },
    { id: 'library', label: 'Library', icon: 'fa-solid fa-book-open' },
  ];

  return (
    <aside className="w-72 h-screen sidebar-premium flex flex-col z-[100] relative overflow-hidden shadow-2xl">
      <div className="scan-line"></div>
      
      {/* Perfil Compacto Premium */}
      <div className="p-6 border-b border-white/5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition"></div>
            <div className="w-16 h-16 rounded-full border-2 border-white/10 p-0.5 bg-black overflow-hidden relative z-10">
              <img src={avatarGif} alt="Profile" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-red-600 text-[8px] font-tech font-bold px-1.5 py-0.5 rounded border border-white/20 z-20">
              LV 99
            </div>
          </div>
          
          <div className="min-w-0">
            <h2 className="font-tech text-sm font-bold metallic-silver truncate uppercase tracking-wider">
              <span className="text-blue-500">[{teamTag}]</span> {username}
            </h2>
            <p className="text-[9px] font-tech text-white/30 uppercase tracking-[0.3em] mt-1">Elite Duelist</p>
          </div>
        </div>

        {/* Stats Grid Compacto */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Score', value: '18450', color: 'text-gray-300' },
            { label: 'Rank', value: '#04', color: 'text-blue-400' },
            { label: 'Vit', value: '1240', color: 'text-green-500' },
            { label: 'Der', value: '182', color: 'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="stat-box p-2 rounded flex flex-col items-center">
              <span className="text-[8px] font-tech font-semibold text-white/20 uppercase">{s.label}</span>
              <span className={`text-[10px] font-tech font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Economia Premium */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between bg-white/[0.03] px-3 py-2 rounded border border-white/5 group hover:border-yellow-500/30 transition">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-coins text-yellow-500 text-[10px]"></i>
              <span className="text-[9px] font-tech font-bold text-white/40">DragonsCoin</span>
            </div>
            <span className="text-[11px] font-tech font-bold text-yellow-500">25.840 <span className="text-[8px] opacity-40">DC</span></span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.03] px-3 py-2 rounded border border-white/5 group hover:border-blue-500/30 transition">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-[10px]"></i>
              <span className="text-[9px] font-tech font-bold text-white/40">WizardMoney</span>
            </div>
            <span className="text-[11px] font-tech font-bold text-blue-400">1.500 <span className="text-[8px] opacity-40">WM</span></span>
          </div>
        </div>
      </div>

      {/* Navegação Legível */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full group flex items-center gap-4 px-4 py-2.5 rounded transition-all duration-300 relative ${
              activeTab === item.id 
              ? 'bg-blue-600/10 text-white border border-blue-500/20' 
              : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-blue-500 rounded-r shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            )}
            <i className={`${item.icon} text-xs transition-transform group-hover:scale-110 ${activeTab === item.id ? 'text-blue-500' : ''}`}></i>
            <span className="text-[11px] font-tech font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}

        <div className="pt-4 border-t border-white/5 mt-4">
          <button className="w-full flex items-center gap-4 px-4 py-2.5 text-white/40 hover:text-blue-400 hover:bg-white/5 rounded transition-all group">
            <i className="fa-solid fa-gamepad text-xs"></i>
            <span className="text-[11px] font-tech font-bold uppercase tracking-widest">Reino dos Duelistas</span>
          </button>
        </div>
      </nav>

      {/* Botão Logout */}
      <div className="p-6 bg-black/20 border-t border-white/5">
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-2.5 bg-red-900/10 hover:bg-red-600 text-red-500 hover:text-white rounded border border-red-500/20 font-tech font-bold text-[10px] uppercase tracking-[0.3em] transition-all"
        >
          Desconectar
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
