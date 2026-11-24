import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { HeroSegment } from '../content.models';
import { CssColorProbe } from '../../services/theme/css-colors';

const DRAW_IN_MS = 30000;
const DRAW_IN_EASE_POWER = 6; // ease-out: draws fast at first, eases into the last stretch
const HOLD_ALPHA = 0.28;
const PULSE_AMPLITUDE = 0.12;
const PULSE_SPEED = 0.0009;
const STRAND_JITTER = 18;
const STRANDS = 5;
const SAMPLES_PER_SEGMENT = 10;
const MOBILE_WIDTH = 768;
const BAND_HALF_WIDTH = 0.22;

interface AnchorPoint {
  x: number;
  y: number;
  phase: number;
}

interface FlatStrand {
  points: { x: number; y: number }[];
  cum: number[];
  total: number;
  color: [number, number, number];
}

/** Samples the same moveTo/quadraticCurveTo/lineTo path drawFrame strokes, so the
 * "revealed so far" portion can be computed as an arc-length fraction. */
function flattenStrandPath(pts: { x: number; y: number }[]): {
  points: { x: number; y: number }[];
  cum: number[];
  total: number;
} {
  if (pts.length < 2) {
    return { points: pts.map((p) => ({ ...p })), cum: pts.map(() => 0), total: 0 };
  }
  const flat: { x: number; y: number }[] = [{ ...pts[0] }];
  let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const ctrl = pts[i];
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    for (let step = 1; step <= SAMPLES_PER_SEGMENT; step++) {
      const t = step / SAMPLES_PER_SEGMENT;
      const it = 1 - t;
      flat.push({
        x: it * it * prev.x + 2 * it * t * ctrl.x + t * t * mid.x,
        y: it * it * prev.y + 2 * it * t * ctrl.y + t * t * mid.y,
      });
    }
    prev = mid;
  }
  flat.push({ ...pts[pts.length - 1] });

  const cum = [0];
  for (let i = 1; i < flat.length; i++) {
    const dx = flat[i].x - flat[i - 1].x;
    const dy = flat[i].y - flat[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return { points: flat, cum, total: cum[cum.length - 1] };
}

/** Strokes only the portion of a pre-flattened strand up to `revealLen` along its
 * cumulative arc length — the progressive "draw-in" reveal. */
function strokeRevealed(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  cum: number[],
  revealLen: number,
): void {
  if (revealLen <= 0 || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  let i = 1;
  for (; i < points.length; i++) {
    if (cum[i] >= revealLen) break;
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (i < points.length) {
    const prevLen = cum[i - 1];
    const segLen = cum[i] - prevLen;
    const localT = segLen > 0 ? (revealLen - prevLen) / segLen : 0;
    const p0 = points[i - 1];
    const p1 = points[i];
    ctx.lineTo(p0.x + (p1.x - p0.x) * localT, p0.y + (p1.y - p0.y) * localT);
  }
  ctx.stroke();
}

/** `#rrggbb` (what `CssColorProbe` answers) as an RGB triple; an unparsable value gives black. */
function hexToRgb(hex: string): [number, number, number] {
  const n = /^#[0-9a-f]{6}$/i.test(hex.trim()) ? parseInt(hex.trim().slice(1), 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The canvas's two strand colours, as design-system tokens: resolved at draw time, in the band's (dark) scheme. */
const STRAND_COLOURS = ['var(--color-red-text)', 'var(--band-dark-ink)'] as const;

/**
 * The home page's hero: a dark design-system band (`cu-band cu-band--near-black`, which sets `color-scheme: dark`,
 * so every token inside takes its dark value in either page mode), an italic-accent-word headline, and a
 * decorative canvas: a simplified Canvas 2D approximation of the live site's WebGL flowing-curve graphic, confined
 * to the bottom-right corner. The graphic is generated once, draws in on load, then pulses alpha in place.
 *
 * Colours are tokens only. The accent words use `--color-red-text`, the design system's contrast-checked red for
 * text (carnelian in light, a light red on a dark surface). The canvas cannot read `var()`, so it resolves its
 * colours with `CssColorProbe` at an invisible element inside the band (design-system-port, Step 3).
 */
@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hero cu-band cu-band--near-black' },
  template: `
    <canvas class="hero-canvas" #canvasRef aria-hidden="true"></canvas>
    <span class="probe" #probeRef aria-hidden="true"></span>
    <div class="inner cu-container">
      <h1>
        @for (seg of title(); track $index) {
          @if (seg.accent) {
            <em class="accent">{{ seg.text }}</em>
          } @else {
            <span>{{ seg.text }}</span>
          }
          {{ ' ' }}
        }
      </h1>
      @if (subtitle()) {
        <p>{{ subtitle() }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }
    @media (min-width: 768px) {
      :host { min-height: 36rem; display: flex; align-items: center; }
    }
    .hero-canvas {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      display: block;
    }
    .probe { position: absolute; inline-size: 0; block-size: 0; overflow: hidden; }
    .inner {
      position: relative;
      z-index: 1;
      width: 100%;
      padding-block: var(--space-8);
    }
    h1 {
      font-family: var(--font-sans);
      font-size: clamp(3rem, 8vw, 6rem);
      line-height: 1.15;
      margin: 0 0 var(--space-4);
      font-weight: var(--weight-regular);
      color: inherit;
    }
    h1 .accent { color: var(--color-red-text); font-style: italic; font-weight: var(--weight-bold); }
    p { max-width: 60rem; font-size: clamp(1.125rem, 2.2vw, 1.625rem); line-height: 1.3; margin: 0; }
  `,
})
export class HeroComponent {
  readonly title = input.required<HeroSegment[]>();
  readonly subtitle = input('');

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasRef');
  private readonly probeRef = viewChild<ElementRef<HTMLElement>>('probeRef');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Hero canvas animation disabled for now — to re-enable, import afterNextRender from
    // @angular/core and uncomment the line below.
    // afterNextRender(() => this.initHeroCanvas());
  }

  private initHeroCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const hostEl = this.host.nativeElement;
    const probeEl = this.probeRef()?.nativeElement;
    if (!probeEl) return;
    const probe = new CssColorProbe(probeEl);
    const [rA, gA, bA] = hexToRgb(probe.resolve(STRAND_COLOURS[0]));
    const [rB, gB, bB] = hexToRgb(probe.resolve(STRAND_COLOURS[1]));

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = () => window.innerWidth < MOBILE_WIDTH;

    // Decorative animation only renders at tablet/desktop widths — on mobile
    // there's no room for it without covering the heading, so the canvas is
    // simply left blank.
    if (isMobile()) return;

    let width = 0;
    let height = 0;
    let strands: FlatStrand[] = [];
    let startTime: number | null = null;
    let rafId: number | null = null;

    const resize = () => {
      const rect = hostEl.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Anchors sit on a single diagonal band confined to the bottom-right corner
    // of the hero — clear of the left-aligned heading — running from just
    // off the bottom edge up to just past the top-right corner.
    const buildStrands = () => {
      const count = isMobile() ? 4 : 7;
      const anchors: AnchorPoint[] = Array.from({ length: count }, () => {
        const t = Math.random(); // 0 = bottom-center-right, 1 = top-right
        const baseX = width * (0.5 + t * 0.55);
        const baseY = height * (1.05 - t * 1.0);
        const spread = (Math.random() - 0.5) * 2 * BAND_HALF_WIDTH * Math.min(width, height);
        return {
          x: baseX + spread * 0.707,
          y: baseY + spread * 0.707,
          phase: Math.random() * Math.PI * 2,
        };
      });

      strands = Array.from({ length: STRANDS }, (_, s) => {
        const v = s / (STRANDS - 1);
        const color: [number, number, number] = [
          Math.round(rA + v * (rB - rA)),
          Math.round(gA + v * (gB - gA)),
          Math.round(bA + v * (bB - bA)),
        ];
        // Fixed per-strand jitter — spreads the strands apart into a cohesive
        // bundle without any per-frame drift, so the shape never repositions.
        const pts = anchors.map((a) => ({
          x: a.x + Math.sin(a.phase + s * 2.1) * STRAND_JITTER,
          y: a.y + Math.cos(a.phase + s * 1.3) * STRAND_JITTER,
        }));
        const { points, cum, total } = flattenStrandPath(pts);
        return { points, cum, total, color };
      });
    };

    const drawFrame = (elapsed: number, animate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      const lineWidth = isMobile() ? 1.6 : 2.4;
      const linearProgress = animate ? Math.min(1, elapsed / DRAW_IN_MS) : 1;
      const revealProgress = 1 - Math.pow(1 - linearProgress, DRAW_IN_EASE_POWER);

      for (let s = 0; s < strands.length; s++) {
        const strand = strands[s];
        const pulse =
          animate && revealProgress >= 1 ? PULSE_AMPLITUDE * Math.sin(elapsed * PULSE_SPEED + s) : 0;
        const alpha = Math.max(0.05, HOLD_ALPHA + pulse);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#' + strand.color.map((c) => c.toString(16).padStart(2, '0')).join('');
        ctx.lineWidth = lineWidth;
        strokeRevealed(ctx, strand.points, strand.cum, strand.total * revealProgress);
      }
    };

    resize();
    buildStrands();

    if (reducedMotion) {
      drawFrame(0, false);
      const ro = new ResizeObserver(() => {
        resize();
        buildStrands();
        drawFrame(0, false);
      });
      ro.observe(hostEl);
      this.destroyRef.onDestroy(() => ro.disconnect());
      return;
    }

    const ro = new ResizeObserver(() => {
      resize();
      buildStrands();
    });
    ro.observe(hostEl);

    const loop = (now: number) => {
      if (startTime === null) startTime = now;
      drawFrame(now - startTime, true);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    this.destroyRef.onDestroy(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    });
  }
}
