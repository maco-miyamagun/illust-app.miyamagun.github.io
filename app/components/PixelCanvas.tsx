"use client";
import React, { useEffect, useRef, useState } from "react";

import { useAtom } from "jotai";
import { colorState, selectedToolState } from "../utils/state";

const WIDTH = 300;
const HEIGHT = 300;

export default function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);

  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const colorBufferRef = useRef<WebGLBuffer | null>(null);
  const positionAttribLocationRef = useRef<number | null>(null);
  const colorAttribLocationRef = useRef<number | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);

  const lastPos = useRef<number[] | null>(null);
  const dragStartPos = useRef<number[] | null>(null);

  // 2D配列でピクセルごとの色情報を管理
  const pixelDataRef = useRef<(Color | null)[][]>(
    Array.from({ length: HEIGHT }, () =>
      Array.from({ length: WIDTH }, () => null)
    )
  );

  const [selected_tool, setSelectedTool] = useAtom(selectedToolState);

  const canvas_size = useRef<number[]>([WIDTH, HEIGHT]);
  const [color] = useAtom(colorState);

  const [position, setPosition] = useState<number[]>([0, 0]);
  const [scale, setScale] = useState<number>(500 / WIDTH);
  const [rotation, setRotation] = useState<number>(0);
  const prev_pos = useRef<number[]>([0, 0]);

  const [, setPointers] = useState<Map<number, PointerEvent>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl");
    if (!gl) {
      alert("WebGL 未サポート");
      return;
    }

    document.addEventListener(
      "keydown",
      (e) => {
        keyControl(e.code);
      },
      false
    );

    const vsSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      varying vec4 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_color = a_color;
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `;

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)!;
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)!;
    const program = createProgram(gl, vs, fs)!;
    gl.useProgram(program);

    const posBuffer = gl.createBuffer()!;
    const colBuffer = gl.createBuffer()!;
    const posAttrib = gl.getAttribLocation(program, "a_position");
    const colAttrib = gl.getAttribLocation(program, "a_color");

    gl.enableVertexAttribArray(posAttrib);
    gl.enableVertexAttribArray(colAttrib);

    glRef.current = gl;
    programRef.current = program;
    positionBufferRef.current = posBuffer;
    colorBufferRef.current = colBuffer;
    positionAttribLocationRef.current = posAttrib;
    colorAttribLocationRef.current = colAttrib;

    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }, []);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();

    const { centerX, centerY } = getCenter(
      rect.left,
      rect.top,
      rect.right,
      rect.bottom
    );

    const relativePos = rotatePoint(
      clientX,
      clientY,
      centerX,
      centerY,
      rotation
    );

    const scaleX = WIDTH / canvas_size.current[0];
    const scaleY = HEIGHT / canvas_size.current[1];
    const x = Math.floor(
      (relativePos.x / scale + canvas_size.current[0] / 2) * scaleX
    );
    const y = Math.floor(
      (relativePos.y / scale + canvas_size.current[0] / 2) * scaleY
    );
    return { x, y };
  };

  const handleMouseDown = (clientX: number, clientY: number) => {
    lastPos.current = null;
    dragStartPos.current = [clientX, clientY];
    setIsDrawing(true);
  };

  const handleMouseMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    if (!dragStartPos.current) return;

    const { x, y } = getCanvasCoords(clientX, clientY);

    switch (selected_tool) {
      case "Draw":
        if (lastPos.current) {
          interpolateLine(
            [lastPos.current[0], lastPos.current[1]],
            [x, y],
            [color.r / 255, color.g / 255, color.b / 255, color.a]
          );
        }
        lastPos.current = [x, y];

        paintPixel(x, y, [
          color.r / 255,
          color.g / 255,
          color.b / 255,
          color.a,
        ]); // 赤
        drawAllPixels(); // 毎回全体再構築
        break;

      case "Eraser":
        if (lastPos.current) {
          interpolateLine(
            [lastPos.current[0], lastPos.current[1]],
            [x, y],
            null
          );
        }
        lastPos.current = [x, y];

        paintPixel(x, y, null); // 消去
        drawAllPixels(); // 毎回全体再構築
        break;
      case "Move":
        setPosition([
          clientX - dragStartPos.current[0] + prev_pos.current[0],
          clientY - dragStartPos.current[1] + prev_pos.current[1],
        ]);
        break;

      case "Rotation":
        setRotation((clientX - dragStartPos.current[0]) * 0.01 + rotation);
        break;

      case "Zoom":
        if (dragStartPos.current[0] - clientX < 0) {
          setScale((_scale) => Math.min(_scale + 0.01, 5));
        } else {
          setScale((_scale) => Math.max(_scale - 0.01, 0.5));
        }
        break;
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    dragStartPos.current = null;
    prev_pos.current = position;
  };

  const keyControl = (key_code: string) => {
    switch (key_code) {
      case "KeyD":
        setSelectedTool("Draw");
        break;
      case "KeyE":
        setSelectedTool("Eraser");
        break;
      case "KeyM":
        setSelectedTool("Move");
        break;
      case "KeyR":
        setSelectedTool("Rotation");
        break;
      case "KeyZ":
        setSelectedTool("Zoom");
        break;
    }
  };

  const paintPixel = (x: number, y: number, color: Color | null) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;

    if (!color) {
      pixelDataRef.current[y][x] = null;
      return;
    }

    const current = pixelDataRef.current[y][x];
    if (current && current.toString() === color.toString()) return; // 既に同じ色ならスキップ

    pixelDataRef.current[y][x] = color;
  };

  // ユークリッド距離に基づいて、間隔を細かく補完する処理
  const interpolateLine = (p1: number[], p2: number[], color: Color | null) => {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(distance)); // ピクセル単位の補完

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(p1[0] + dx * t);
      const y = Math.round(p1[1] + dy * t);

      paintPixel(x, y, color);
    }
  };

  const drawAllPixels = () => {
    const gl = glRef.current!;
    const posAttrib = positionAttribLocationRef.current!;
    const colAttrib = colorAttribLocationRef.current!;
    const posBuffer = positionBufferRef.current!;
    const colBuffer = colorBufferRef.current!;
    const program = programRef.current!;

    const vertices: number[] = [];
    const colors: number[] = [];

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const color = pixelDataRef.current[y][x];
        if (!color) continue;

        const fx = (x / WIDTH) * 2 - 1;
        const fy = 1 - (y / HEIGHT) * 2;
        const sizeX = 2 / WIDTH;
        const sizeY = 2 / HEIGHT;

        const quad = [
          fx,
          fy,
          fx + sizeX,
          fy,
          fx,
          fy - sizeY,
          fx + sizeX,
          fy,
          fx + sizeX,
          fy - sizeY,
          fx,
          fy - sizeY,
        ];
        vertices.push(...quad);

        const quadColor = Array(6).fill(color).flat();
        colors.push(...quadColor);
      }
    }

    const vertexArray = new Float32Array(vertices);
    const colorArray = new Float32Array(colors);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorArray, gl.STATIC_DRAW);
    gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, vertexArray.length / 2);
  };

  return (
    <div>
      <div
        className="overflow-hidden h-[605px] w-[1000px] ml-3 border-2 border-slate-300 rounded-lg bg-slate-100 flex items-center justify-center"
        onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault();

          setPointers((prev) => new Map(prev).set(e.pointerId, e.nativeEvent));

          handleMouseDown(e.clientX, e.clientY);
        }}
        onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault();

          if (e.pointerType == "touch") {
            setPointers((prev) => {
              const newMap = new Map(prev);
              newMap.set(e.pointerId, e.nativeEvent);

              if (newMap.size === 2) {
                const [a, b] = Array.from(newMap.values());
                const result = classifyGesture(
                  [a.clientX + b.clientX / 2, a.clientY + b.clientY / 2],
                  [a.clientX, a.clientY],
                  [b.clientX, b.clientY],
                  [a.movementX, a.movementY],
                  [b.movementX, b.movementY]
                );

                if (result.type == 1) {
                  // 2本指で移動
                  setPosition((prev) => [
                    prev[0] + result.delta[0] / 3,
                    prev[1] + result.delta[1] / 3,
                  ]);
                } else if (result.type == 2) {
                  setRotation((prev) => prev + result.delta[0] / 3);
                } else if (result.type == 3) {
                  // 拡大縮小処理
                  setScale((prev) => prev * result.delta[0]);

                  //   setPosition((prev) => [
                  //     prev[0] + (a.clientX + b.clientX / 2 - prev[0]) / 100,
                  //     prev[1] + (a.clientY + b.clientY / 2 - prev[1]) / 100,
                  //   ]);
                }
              }

              return newMap;
            });

            return;
          }

          handleMouseMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e: React.PointerEvent<HTMLDivElement>) => {
          setPointers((prev) => {
            const newMap = new Map(prev);
            newMap.delete(e.pointerId);
            return newMap;
          });

          handleMouseUp();
        }}
        onPointerCancel={(e: React.PointerEvent<HTMLDivElement>) => {
          setPointers((prev) => {
            const newMap = new Map(prev);
            newMap.delete(e.pointerId);
            return newMap;
          });

          handleMouseUp();
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvas_size.current[0]}
          height={canvas_size.current[1]}
          style={{
            transform: `
            translate(${position[0]}px, ${position[1]}px)
            rotate(${rotation}deg)
            scale(${scale})
          `,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader
) {
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// 回転行列を使って点を回転させる関数
function rotatePoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  angle: number
) {
  // 角度をラジアンに変換
  const rad = -(angle * Math.PI) / 180;

  // 回転行列を適用
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 中心点からの相対座標に変換
  const relativeX = x - centerX;
  const relativeY = y - centerY;

  // 回転後の座標を計算
  const rotatedX = relativeX * cos - relativeY * sin;
  const rotatedY = relativeX * sin + relativeY * cos;

  return { x: rotatedX, y: rotatedY };
}

// 四角形の中心を求める
function getCenter(
  topLeftX: number,
  topRightY: number,
  bottomRightX: number,
  bottomLeftY: number
) {
  const centerX = (topLeftX + bottomRightX) / 2;
  const centerY = (topRightY + bottomLeftY) / 2;
  return { centerX, centerY };
}

type Vec2 = [number, number];

type GestureResult = {
  type: 1 | 2 | 3; // 1: pan, 2: rotate, 3: zoom
  delta: number[]; // angle (deg), scale, or translation vector
};

function classifyGesture(
  startP: Vec2,
  p1: Vec2,
  p2: Vec2,
  m1: Vec2,
  m2: Vec2
): GestureResult {
  const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
  const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
  const scale = (v: Vec2, s: number): Vec2 => [v[0] * s, v[1] * s];
  const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
  const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
  const length = (v: Vec2): number => Math.hypot(v[0], v[1]);
  const normalize = (v: Vec2): Vec2 => {
    const len = length(v);
    return len === 0 ? [0, 0] : [v[0] / len, v[1] / len];
  };
  const angleBetween = (a: Vec2, b: Vec2): number => {
    const na = normalize(a);
    const nb = normalize(b);
    const cos = dot(na, nb);
    return Math.acos(Math.min(1, Math.max(-1, cos))); // 安全にクランプ
  };

  // 過去の位置（現在位置 - 移動量）
  const prevP1: Vec2 = sub(p1, m1);
  const prevP2: Vec2 = sub(p2, m2);

  // それぞれの中点（パン用）
  const prevMid: Vec2 = scale(add(prevP1, prevP2), 0.5);
  const currMid: Vec2 = scale(add(p1, p2), 0.5);
  const translation: Vec2 = sub(currMid, prevMid);

  // ズーム量
  const prevDist = length(sub(prevP1, prevP2));
  const currDist = length(sub(p1, p2));
  const scaleChange = prevDist !== 0 ? currDist / prevDist : 1;

  // 回転角
  const angleRad = angleBetween(sub(prevP2, prevP1), sub(p2, p1));
  const crossSign = Math.sign(cross(sub(prevP2, prevP1), sub(p2, p1))); // 回転方向
  const angleDeg = ((angleRad * 180) / Math.PI) * crossSign;

  // 平行移動チェック
  const m1n = normalize(m1);
  const m2n = normalize(m2);
  const moveDot = dot(m1n, m2n);
  const moveDiff = length(sub(m1, m2));

  // =============================
  // 精密分類ロジック
  // =============================

  if (Math.abs(angleDeg) > 3 && Math.abs(scaleChange - 1) < 0.05) {
    return { type: 2, delta: [angleDeg] }; // 回転
  }

  if (Math.abs(scaleChange - 1) > 0.05 && Math.abs(angleDeg) < 3) {
    return { type: 3, delta: [scaleChange] }; // ズーム
  }

  if (
    moveDot > 0.98 &&
    moveDiff < 8 &&
    Math.abs(angleDeg) < 3 &&
    Math.abs(scaleChange - 1) < 0.05
  ) {
    return { type: 1, delta: translation }; // パン
  }

  // 混合パターン（デフォルトで角度があれば回転、なければズーム優先）
  if (Math.abs(angleDeg) >= Math.abs((scaleChange - 1) * 180)) {
    return { type: 2, delta: [angleDeg] };
  } else {
    return { type: 3, delta: [scaleChange] };
  }
}
