import Icon from "@/components/ui/icon";

interface Stream {
  id: number;
  title: string;
  host: string;
  avatar: string;
  viewers: number;
  isLive: boolean;
  category: string;
  thumb: string;
  rating: number;
  products: number;
  startedAt: string;
}

export default function StreamCard({ stream }: { stream: Stream }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group cursor-pointer">
      <div className="video-thumb">
        <img src={stream.thumb} alt={stream.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Live badge */}
        {stream.isLive ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />
            LIVE
          </div>
        ) : (
          <div className="absolute top-3 left-3 bg-black/60 text-muted-foreground text-[11px] font-medium px-2 py-1 rounded">
            Запись
          </div>
        )}

        {stream.isLive && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white text-[11px] px-2 py-1 rounded">
            <Icon name="Eye" size={11} />
            {stream.viewers.toLocaleString("ru")}
          </div>
        )}

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon name="Play" size={20} className="text-white ml-1" />
          </div>
        </div>

        {/* Products count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 text-white text-[11px] px-2 py-1 rounded">
          <Icon name="ShoppingBag" size={11} />
          {stream.products} товаров
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
            {stream.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{stream.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{stream.host}</span>
              <span className="text-border">·</span>
              <span className="text-xs text-muted-foreground">{stream.startedAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
            {stream.category}
          </span>
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Icon name="Star" size={12} />
            {stream.rating}
          </div>
        </div>
      </div>
    </div>
  );
}
