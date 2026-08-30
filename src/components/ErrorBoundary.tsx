import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      // Clear UI experiments and view settings that might have caused render errors
      localStorage.removeItem('yapim_ui_experiments');
      localStorage.removeItem('yapim_view_settings');
      // Reload clean
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  private handleFullReset = () => {
    if (window.confirm('Tüm yerel önbellek sıfırlanacak. Yerel bağlı klasörünüzdeki (varsa) yapım-arsivim-data.json dosyanız etkilenmez. Onaylıyor musunuz?')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#101216] text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
          <div className="max-w-lg w-full bg-neutral-900/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">
                  Lore — Başlatma Sorunu Giderildi
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Beklenmeyen bir arayüz hatası yakalandı. Verileriniz güvendedir.
                </p>
              </div>
            </div>

            {/* Error detail */}
            <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 space-y-1.5 overflow-hidden">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Hata Ayrıntısı
              </span>
              <p className="text-xs font-mono text-red-400 break-words leading-relaxed">
                {this.state.error?.message || 'Bilinmeyen arayüz hatası'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Sayfayı Yeniden Yükle</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-blue-400" />
                <span>Görünüm Ayarlarını Sıfırla & Onar</span>
              </button>

              <button
                type="button"
                onClick={this.handleFullReset}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium border border-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tam Önbellek Sıfırlama</span>
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-500 leading-relaxed">
              Masaüstü PWA veya web tarayıcısında önbellek hatası oluştuğunda yukarıdaki butonlarla tek tıkla uygulamayı sorunsuz başlatabilirsiniz.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
