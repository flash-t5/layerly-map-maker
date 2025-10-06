import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pencil, Eraser, Eye, EyeOff, Save, FolderOpen, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import backgroundSprite from "@/assets/spritesheet-backgrounds.png";
import tilesSprite from "@/assets/spritesheet-tiles.png";
import enemiesSprite from "@/assets/spritesheet-enemies.png";
import characterSprite from "@/assets/spritesheet-characters.png";

const TILE_SIZE = 64;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 12;

type TileData = {
  spriteX: number;
  spriteY: number;
  spriteSheet: string;
} | null;

type Layer = {
  name: string;
  visible: boolean;
  data: TileData[][];
  spriteSheet: string;
};

export const TileMapEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [selectedTile, setSelectedTile] = useState({ x: 0, y: 0, sheet: "background" });
  const [layers, setLayers] = useState<Layer[]>([
    { name: "background", visible: true, data: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null)), spriteSheet: backgroundSprite },
    { name: "foreground", visible: true, data: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null)), spriteSheet: tilesSprite },
    { name: "enemies", visible: true, data: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null)), spriteSheet: enemiesSprite },
  ]);
  const [activeLayer, setActiveLayer] = useState("foreground");
  const [images, setImages] = useState<{ [key: string]: HTMLImageElement }>({});
  const [playerPos, setPlayerPos] = useState({ x: 2, y: 8 });
  const [playerVel, setPlayerVel] = useState({ x: 0, y: 0 });
  const [isJumping, setIsJumping] = useState(false);
  const keysPressed = useRef<Set<string>>(new Set());

  // Load sprite sheets
  useEffect(() => {
    const loadImage = (src: string, key: string) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImages(prev => ({ ...prev, [key]: img }));
      };
    };

    loadImage(backgroundSprite, "background");
    loadImage(tilesSprite, "foreground");
    loadImage(enemiesSprite, "enemies");
    loadImage(characterSprite, "character");
  }, []);

  // Game loop for playtest mode
  useEffect(() => {
    if (!isPlaying) return;

    const gameLoop = setInterval(() => {
      setPlayerVel(prev => {
        let newVelX = prev.x;
        let newVelY = prev.y + 0.5; // Gravity

        // Movement
        if (keysPressed.current.has("ArrowLeft")) newVelX = -3;
        else if (keysPressed.current.has("ArrowRight")) newVelX = 3;
        else newVelX = 0;

        return { x: newVelX, y: Math.min(newVelY, 10) };
      });

      setPlayerPos(prev => {
        let newX = prev.x + playerVel.x * 0.1;
        let newY = prev.y + playerVel.y * 0.1;

        // Collision with foreground tiles
        const foregroundLayer = layers.find(l => l.name === "foreground");
        if (foregroundLayer) {
          const gridX = Math.floor(newX);
          const gridY = Math.floor(newY);
          const gridYBelow = Math.floor(newY + 0.9);

          // Check ground collision
          if (gridYBelow >= 0 && gridYBelow < GRID_HEIGHT && gridX >= 0 && gridX < GRID_WIDTH) {
            if (foregroundLayer.data[gridYBelow][gridX]) {
              newY = gridYBelow;
              setPlayerVel(prev => ({ ...prev, y: 0 }));
              setIsJumping(false);
            }
          }

          // Boundaries
          newX = Math.max(0, Math.min(GRID_WIDTH - 1, newX));
          newY = Math.max(0, Math.min(GRID_HEIGHT - 1, newY));
        }

        return { x: newX, y: newY };
      });
    }, 1000 / 60);

    return () => clearInterval(gameLoop);
  }, [isPlaying, playerVel, layers]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === " " && !isJumping && isPlaying) {
        setIsJumping(true);
        setPlayerVel(prev => ({ ...prev, y: -8 }));
        new Audio("/sfx_jump.ogg").play().catch(() => {});
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isJumping, isPlaying]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    if (!isPlaying) {
      ctx.strokeStyle = "hsl(var(--editor-grid))";
      ctx.lineWidth = 1;
      for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE, 0);
        ctx.lineTo(x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE);
        ctx.lineTo(GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
        ctx.stroke();
      }
    }

    // Draw layers
    layers.forEach(layer => {
      if (!layer.visible) return;
      const img = images[layer.name];
      if (!img) return;

      layer.data.forEach((row, y) => {
        row.forEach((tile, x) => {
          if (tile) {
            ctx.drawImage(
              img,
              tile.spriteX,
              tile.spriteY,
              TILE_SIZE,
              TILE_SIZE,
              x * TILE_SIZE,
              y * TILE_SIZE,
              TILE_SIZE,
              TILE_SIZE
            );
          }
        });
      });
    });

    // Draw player in playtest mode
    if (isPlaying && images.character) {
      ctx.drawImage(
        images.character,
        0, // character_beige_idle
        512,
        128,
        128,
        playerPos.x * TILE_SIZE,
        playerPos.y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }, [layers, images, isPlaying, playerPos]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

    setLayers(prev => prev.map(layer => {
      if (layer.name !== activeLayer) return layer;

      const newData = layer.data.map(row => [...row]);
      if (tool === "draw") {
        newData[y][x] = {
          spriteX: selectedTile.x,
          spriteY: selectedTile.y,
          spriteSheet: layer.spriteSheet
        };
      } else {
        newData[y][x] = null;
      }

      return { ...layer, data: newData };
    }));
  };

  const toggleLayerVisibility = (layerName: string) => {
    setLayers(prev => prev.map(layer =>
      layer.name === layerName ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const saveLevel = () => {
    localStorage.setItem("tilemap-level", JSON.stringify(layers));
    toast.success("Level saved!");
  };

  const loadLevel = () => {
    const saved = localStorage.getItem("tilemap-level");
    if (saved) {
      setLayers(JSON.parse(saved));
      toast.success("Level loaded!");
    } else {
      toast.error("No saved level found");
    }
  };

  const handlePlayTest = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Reset player position
      setPlayerPos({ x: 2, y: 8 });
      setPlayerVel({ x: 0, y: 0 });
      setIsJumping(false);
      toast.info("Use Arrow Keys to move, Space to jump!");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Tile Map Editor</h1>
          <div className="flex gap-2">
            <Button onClick={saveLevel} variant="secondary" size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button onClick={loadLevel} variant="secondary" size="sm">
              <FolderOpen className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button onClick={handlePlayTest} variant={isPlaying ? "destructive" : "default"} size="sm">
              {isPlaying ? "Stop" : <><Play className="w-4 h-4 mr-2" />Play Test</>}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Card className="p-4 bg-card">
              <canvas
                ref={canvasRef}
                width={GRID_WIDTH * TILE_SIZE}
                height={GRID_HEIGHT * TILE_SIZE}
                onClick={handleCanvasClick}
                className="border border-border rounded bg-[hsl(var(--editor-canvas))] cursor-crosshair"
              />
            </Card>
          </div>

          <div className="space-y-4">
            {!isPlaying && (
              <>
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-foreground">Tools</h3>
                  <div className="flex gap-2">
                    <Button
                      variant={tool === "draw" ? "default" : "outline"}
                      onClick={() => setTool("draw")}
                      className="flex-1"
                      size="sm"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={tool === "erase" ? "default" : "outline"}
                      onClick={() => setTool("erase")}
                      className="flex-1"
                      size="sm"
                    >
                      <Eraser className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-foreground">Layers</h3>
                  <div className="space-y-2">
                    {layers.map(layer => (
                      <div key={layer.name} className="flex items-center gap-2">
                        <Button
                          variant={activeLayer === layer.name ? "default" : "outline"}
                          onClick={() => setActiveLayer(layer.name)}
                          className="flex-1 capitalize"
                          size="sm"
                        >
                          {layer.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLayerVisibility(layer.name)}
                        >
                          {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-foreground">Tile Palette</h3>
                  <Tabs value={activeLayer} onValueChange={setActiveLayer}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="background">BG</TabsTrigger>
                      <TabsTrigger value="foreground">FG</TabsTrigger>
                      <TabsTrigger value="enemies">EN</TabsTrigger>
                    </TabsList>
                    {layers.map(layer => (
                      <TabsContent key={layer.name} value={layer.name}>
                        <TilePalette
                          spriteSheet={layer.spriteSheet}
                          onSelect={(x, y) => setSelectedTile({ x, y, sheet: layer.name })}
                          selectedX={selectedTile.x}
                          selectedY={selectedTile.y}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TilePalette = ({
  spriteSheet,
  onSelect,
  selectedX,
  selectedY,
}: {
  spriteSheet: string;
  onSelect: (x: number, y: number) => void;
  selectedX: number;
  selectedY: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = spriteSheet;
    img.onload = () => setImage(img);
  }, [spriteSheet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // Highlight selected tile
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 3;
    ctx.strokeRect(selectedX, selectedY, TILE_SIZE, TILE_SIZE);
  }, [image, selectedX, selectedY]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE) * TILE_SIZE;
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE) * TILE_SIZE;

    onSelect(x, y);
  };

  return (
    <div className="overflow-auto max-h-[400px] bg-muted/20 p-2 rounded">
      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        onClick={handleClick}
        className="cursor-pointer"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
};
