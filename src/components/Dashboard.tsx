
import React from 'react';

interface DashboardProps {
  onStartDuel: () => void;
  username: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onStartDuel, username }) => {
  return (
    <div className="flex-1 h-screen overflow-y-auto p-10 relative">
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
        
        {/* Cabeçalho Premium Jornal */}
        <header className="flex items-end justify-between border-b border-white/10 pb-10">
          <div>
            <span className="font-tech text-blue-500 text-[11px] tracking-[0.6em] uppercase block mb-3 font-bold">KaibaCorp Intelligence Report</span>
            <h1 className="font-premium text-6xl metallic-silver tracking-widest leading-none">JORNAL</h1>
            <p className="font-tech text-white/30 text-xs mt-4 uppercase tracking-[0.4em]">
              Duelista Autorizado: <span className="text-blue-400 font-bold">{username}</span>
            </p>
          </div>
          <div className="hidden md:flex gap-8">
            <div className="premium-card px-6 py-4 rounded-xl text-center min-w-[130px]">
              <span className="block text-[8px] font-tech text-white/20 uppercase tracking-widest mb-1">Status Rede</span>
              <span className="block text-lg font-tech font-bold text-blue-400">ONLINE</span>
            </div>
            <div className="premium-card px-6 py-4 rounded-xl text-center min-w-[130px]">
              <span className="block text-[8px] font-tech text-white/20 uppercase tracking-widest mb-1">Acesso</span>
              <span className="block text-lg font-tech font-bold text-red-500 uppercase italic">Premium</span>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal do Jornal */}
        <div className="grid grid-cols-12 gap-10">
          
          <div className="col-span-12 lg:col-span-8 space-y-10">
            {/* Notícia de Destaque com Imagem Clássica */}
            <div className="premium-card rounded-3xl overflow-hidden group">
              <div className="relative h-96">
                <img 
                  src="https://images.alphacoders.com/131/1312351.jpeg" 
                  className="absolute w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" 
                  alt="Duelo Épico" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent flex flex-col justify-end p-12">
                  <h2 className="font-premium text-4xl text-white mb-4 tracking-wider uppercase">O Destino do Duelo está em suas mãos</h2>
                  <p className="font-body text-white/50 text-sm max-w-xl leading-relaxed mb-8">
                    O sistema de Duelo da KaibaCorp acaba de receber uma atualização massiva. Desafie oponentes de todo o globo no terminal mais avançado do mundo.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={onStartDuel}
                      className="btn-kc-blue px-10 py-3.5 rounded-lg font-tech text-sm font-bold text-white tracking-[0.2em] uppercase shadow-lg"
                    >
                      Entrar no Duelo
                    </button>
                    <button className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-lg font-tech text-[10px] font-bold text-white/50 hover:text-white transition-all uppercase tracking-widest">
                      Ver Rank Global
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Notícias Secundárias */}
            <div className="grid grid-cols-2 gap-6">
              <div className="premium-card p-6 rounded-2xl hover:bg-white/5 transition-all cursor-pointer border-l-4 border-blue-500">
                <span className="font-tech text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-2 block">Atualização v4.0</span>
                <h4 className="font-tech text-sm font-bold text-white uppercase mb-2">Novos Booster Packs Disponíveis</h4>
                <p className="text-[10px] text-white/30 font-body uppercase leading-relaxed">Série Lendária de Cristal agora na Wizard Shop.</p>
              </div>
              <div className="premium-card p-6 rounded-2xl hover:bg-white/5 transition-all cursor-pointer border-l-4 border-red-500">
                <span className="font-tech text-[10px] text-red-500 font-bold uppercase tracking-widest mb-2 block">Torneio Elite</span>
                <h4 className="font-tech text-sm font-bold text-white uppercase mb-2">KC Grand Championship</h4>
                <p className="text-[10px] text-white/30 font-body uppercase leading-relaxed">Inscrições abertas apenas para duelistas S-RANK.</p>
              </div>
            </div>
          </div>

          {/* Sidebar de Conteúdo (Lado Direito) */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="premium-card p-8 rounded-3xl border border-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <i className="fa-solid fa-crown text-6xl text-blue-500"></i>
              </div>
              <h3 className="font-tech text-xs text-blue-400 font-bold uppercase tracking-[0.3em] mb-8 border-b border-white/5 pb-4">Ranking de Destaque</h3>
              <div className="space-y-6">
                {[
                  { name: 'Seto Kaiba', score: '99999', rank: '01' },
                  { name: 'Yugi Mutou', score: '95420', rank: '02' },
                  { name: 'Joey Wheeler', score: '82100', rank: '03' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <span className="font-tech text-xs font-bold text-white/20 italic">{r.rank}</span>
                      <span className="font-tech text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors uppercase">{r.name}</span>
                    </div>
                    <span className="font-tech text-xs font-bold text-blue-500">{r.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-card p-8 rounded-3xl border border-white/5 bg-black/40">
              <h3 className="font-tech text-xs text-red-500 font-bold uppercase tracking-[0.3em] mb-6">Status dos Servidores</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  <span className="font-tech text-[10px] font-bold text-white/60 uppercase">Mainframes KaibaCorp [Ativos]</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-tech text-[10px] font-bold text-white/60 uppercase">Dueling Network [Estável]</span>
                </div>
              </div>
              <p className="text-[10px] font-body text-white/20 mt-6 leading-relaxed uppercase">Matchmaking processando em menos de 150ms. Conexão otimizada.</p>
            </div>

            {/* Banner de Personagem Lateral */}
            <div className="rounded-3xl overflow-hidden border border-white/5 relative aspect-square grayscale hover:grayscale-0 transition-all duration-700 cursor-pointer">
              <img src="https://images7.alphacoders.com/613/613942.jpg" className="w-full h-full object-cover opacity-50 hover:opacity-100" alt="Kaiba" />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black to-transparent">
                 <span className="font-premium text-lg metallic-silver uppercase tracking-widest">A Revolução começou</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
