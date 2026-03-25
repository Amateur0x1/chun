import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

const P5Sketch: React.FC = () => {
  const sketchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sketch = (p: p5) => {
      let noiseScale = 0.01;
      let gravity = 0.04;
      let initialPoints: any[] = [];
      let currentPointIndex = 0;
      let previousPointIndex = -1;
      let isDone = false;
      let mountainFrameCount = 0;
      let gen: Generator<number, void, unknown> | null = null;
      let mtnX: number[] = [];
      let mtnY: number[] = [];
      let index = 0;

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        mtnX = [p.width / 3, (2 * p.width) / 3];
        mtnY = [p.height / 20, p.height / 2];
        p.background(255);
        generateInitialPoints();
        gen = drawScene();
      };

      const generateInitialPoints = () => {
        let numPoints = 2;
        let minDistance = p.max(p.width, p.height) / 6;
        let attempts = 0;
        let maxAttempts = 1000;

        initialPoints = [];

        while (initialPoints.length < numPoints && attempts < maxAttempts) {
          let newPoint = {
            x: mtnX[index],
            y: mtnY[index],
            vx: 0,
            vy: 0,
            previousX: 0,
          };
          index += 1;
          newPoint.previousX = newPoint.x;

          let valid = true;
          for (let existingPoint of initialPoints) {
            let d = p.dist(newPoint.x, newPoint.y, existingPoint.x, existingPoint.y);
            if (d < minDistance) {
              valid = false;
              break;
            }
          }

          if (valid) {
            initialPoints.push(newPoint);
          }

          attempts++;
        }
        initialPoints = initialPoints.sort((a, b) => a.y - b.y);
      };

      const edgeBiasedRandom = (centerMin = 0.3) => {
        while (true) {
          const u = Math.random();
          const y = Math.random();
          const w = centerMin + (1 - centerMin) * 4 * Math.pow(u - 0.5, 2);
          if (y < w) {
            return u;
          }
        }
      };

      const updateParticle = (point: any) => {
        if (point.y >= p.height) return;

        let yNorm = point.y / p.height;
        let nDetail = p.map(yNorm, 0, 1, 0.01, 1.5);

        let noiseX = p.noise(
          point.x * noiseScale,
          point.y * noiseScale,
          mountainFrameCount * 0.01
        );
        let noiseY = p.noise(
          point.x * noiseScale + 100,
          point.y * noiseScale + 100,
          mountainFrameCount * 0.01
        );

        let angle = p.map(noiseX, 0, 1, -p.PI, p.PI);
        let normalizedX = Math.abs(noiseY - 0.5) * 2;
        normalizedX = Math.pow(normalizedX, 2.5);
        normalizedX = (1 - normalizedX) * (noiseY > 0.5 ? 1 : -1);
        let magnitude = normalizedX * nDetail;

        point.vx += Math.cos(angle) * magnitude * 0.3;
        point.vy += Math.sin(angle) * magnitude * 0.2;

        point.vy += gravity;

        point.x += point.vx;
        point.y += point.vy;

        point.vx *= 0.95;
        point.vy *= 0.95;
      };

      const handleMountainTransition = () => {
        let mPoint = initialPoints[currentPointIndex];
        if (mPoint.x < -p.width / 4 || mPoint.x > (p.width * 5) / 4 || mPoint.y >= p.height) {
          currentPointIndex = currentPointIndex + 1;
          if (currentPointIndex >= initialPoints.length) {
            isDone = true;
          }
        }

        let isNewPoint = currentPointIndex !== previousPointIndex;

        if (isNewPoint) {
          mountainFrameCount = 0;
        }

        mountainFrameCount++;
        previousPointIndex = currentPointIndex;
        return isNewPoint;
      };

      const generateAngles = (T: number, minAngle: number, maxAngle: number, numLines = 60) => {
        let angles = [];
        for (let i = 0; i < numLines; i++) {
          let r = edgeBiasedRandom(0.2);
          let angle = p.map(r, 0, 1, minAngle, maxAngle);
          let a = angle < T ? p.map(angle, p.PI / 8, T, p.PI / 6, T) : angle;
          angles.push(a);
        }
        angles.sort((a, b) => a - b);
        return angles;
      };

      const drawSegmentedLine = (
        point: any,
        angle: number,
        capturePath: boolean,
        T: number,
        midAngle: number,
        maxAngle: number,
        lineIndex: number
      ) => {
        (p.drawingContext as any).setLineDash([
          p.random(20, 40),
          p.random(5, 10),
          p.random(20, 40),
          p.random(5, 10),
          p.random(20, 40),
          p.random(5, 10),
        ]);

        // Spring colors: mapping y-position to green shades
        let greenVal = p.map(point.y, 0, (3 * p.height) / 4, 180, 40);
        if (angle < T) {
          // Shadow side: Darker, more forest green
          p.stroke(20 + p.random(-10, 10), greenVal - 20 + p.random(-10, 10), 20 + p.random(-10, 10));
        } else {
          // Light side: Brighter, more lime/spring green
          p.stroke(greenVal + 40 + p.random(-20, 20), greenVal + 80 + p.random(-20, 20), 40 + p.random(-10, 10));
        }

        let currentX = point.x;
        let currentY = point.y;
        let currentAngle = angle;
        let segmentIndex = 0;
        let totalLength = 0;
        let path = capturePath ? [{ x: currentX, y: currentY }] : null;

        while (true) {
          if (
            currentX < -p.width / 4 ||
            currentX > (p.width * 5) / 4 ||
            currentY < 0 ||
            currentY > p.height
          ) {
            break;
          }
          let startsw = p.map(currentX, 0, p.height, 0.5, 1, true);
          let sw = p.map(totalLength, 0, 250, 0.1 * startsw, 1.25 * startsw, true);
          if (angle < T) {
            sw = sw * 2;
          }
          p.strokeWeight(sw);

          let distToCenter = Math.abs(currentAngle - midAngle);
          let minSegmentLength = p.map(distToCenter, 0, p.PI / 2, 10, 20);
          let maxSegmentLength = p.map(distToCenter, 0, p.PI / 2, 40, 80);
          let noiseRotationScale = p.map(distToCenter, 0, p.PI / 2, 0.1, 0.001);
          let rotationScale = p.map(distToCenter, 0, p.PI / 2, 5, 0.5);

          let segmentLength = p.random(minSegmentLength, maxSegmentLength);
          let nextX = currentX + Math.cos(currentAngle) * segmentLength;
          let nextY = currentY + Math.sin(currentAngle) * segmentLength;

          let offsetX = p.random(-2, 6);
          let offsetY = p.random(-5, 5);
          p.line(currentX, currentY, nextX + offsetX, nextY + offsetY);

          if (path) {
            path.push({ x: nextX, y: nextY });
          }

          totalLength += segmentLength;
          currentX = nextX;
          currentY = nextY;

          let noiseValue = p.noise(
            currentX * noiseRotationScale,
            currentY * noiseRotationScale,
            currentPointIndex * 0.1 + lineIndex * 0.01 + segmentIndex * 0.05
          );
          let rotation = (p.map(noiseValue, 0, 1, -rotationScale, rotationScale) * p.PI) / 180;
          currentAngle += rotation;
          currentAngle = p.constrain(currentAngle, 0, p.PI);
          segmentIndex++;
        }

        return path;
      };

      const extendPathToEdge = (path: any[], angle: number, isRightEdge: boolean) => {
        if (path.length < 2) return { x: path[0].x, y: path[0].y };

        let last = path[path.length - 1];
        let dir = p.atan2(
          last.y - path[path.length - 2].y,
          last.x - path[path.length - 2].x
        );

        let edgeX = isRightEdge ? (p.width * 5) / 4 : -p.width / 4;
        let edgeY = last.y;

        if (Math.abs(Math.cos(dir)) > 0.001) {
          edgeY = last.y + Math.tan(dir) * (edgeX - last.x);
          if (edgeY < 0) {
            edgeY = 0;
            edgeX = last.x + (edgeY - last.y) / Math.tan(dir);
          } else if (edgeY > p.height) {
            edgeY = p.height;
            edgeX = last.x + (edgeY - last.y) / Math.tan(dir);
          }
        } else {
          edgeY = p.height;
        }

        return { x: edgeX, y: edgeY };
      };

      const drawMountainPolygon = (point: any, lowestPath: any[], highestPath: any[], angles: number[]) => {
        let rightEdge = extendPathToEdge(lowestPath, angles[0], true);
        let leftEdge = extendPathToEdge(highestPath, angles[angles.length - 1], false);

        let polygon = [];
        polygon.push({ x: point.x, y: point.y });
        for (let p_ of lowestPath) polygon.push(p_);
        polygon.push({ x: rightEdge.x, y: rightEdge.y });
        polygon.push({ x: rightEdge.x, y: p.height });
        polygon.push({ x: leftEdge.x, y: p.height });
        polygon.push({ x: leftEdge.x, y: p.height }); // Fixed: bottom edge
        for (let i = highestPath.length - 1; i >= 0; i--) polygon.push(highestPath[i]);

        let lowestAngle = angles[0];
        let highestAngle = angles[angles.length - 1];
        let gradient = (p.drawingContext as any).createConicGradient(
          lowestAngle,
          point.x,
          point.y
        );

        let angleRange = highestAngle - lowestAngle;
        let highestOffset = angleRange / (2 * Math.PI);

        // Spring mountain colors: Deep green to bright lime
        gradient.addColorStop(0, "#1a3d1a"); // Dark forest green
        gradient.addColorStop(highestOffset, "#a8d67a"); // Spring green highlight
        gradient.addColorStop(1, "#1a3d1a");

        (p.drawingContext as any).fillStyle = gradient;
        p.noStroke();
        p.beginShape();
        for (let v of polygon) {
          p.vertex(v.x, v.y);
        }
        p.endShape(p.CLOSE);

        (p.drawingContext as any).fillStyle = "rgba(0, 0, 0, 0)";
        p.noFill();
      };

      function* drawClouds(density = 4, passes = 1, perFrame = 50) {
        const baseR = 240; // Whiter clouds for spring
        const baseG = 248;
        const baseB = 255;
        const _step = 5;
        let counter = 0;

        for (let p_ = 0; p_ < passes; p_++) {
          const begin = p.random(50);

          let i = 0;
          for (let x = 0; x < p.width; x += _step) {
            let j = 0;

            for (let y = 0; y < (p.height * 2) / 3; y += _step) {
              const alphaMax = p.map(y, 0, (p.height * 2) / 3, 255, 0);
              let n = p.noise(begin + i, begin + j);
              let alphaBase = p.map(n, 0.3, 1, 0, alphaMax);
              alphaBase = p.constrain(alphaBase, 0, 255);

              if (alphaBase > 5) {
                for (let k = 0; k < density; k++) {
                  const _alpha = alphaBase * p.random(0.5, 1.0);

                  let brightnessJitter = p.random(-10, 10);
                  if (p.random() < 0.05) {
                    brightnessJitter = p.random(-30, -80);
                  }
                  const r = p.constrain(baseR + brightnessJitter, 0, 255);
                  const g = p.constrain(baseG + brightnessJitter, 0, 255);
                  const b = p.constrain(baseB + brightnessJitter, 0, 255);

                  p.strokeWeight(p.random(0.5, 3));
                  p.stroke(r, g, b, _alpha);

                  const len = p.random(10, 20);
                  const angle = p.random(-p.PI / 10, p.PI / 10);

                  const x1 = x + p.random(-5, 5);
                  const y1 = y + p.random(-5, 5);
                  const x2 = x1 + Math.cos(angle) * len;
                  const y2 = y1 + Math.sin(angle) * len;
                  p.line(x1, y1, x2, y2);

                  if (p.random() < 0.5) {
                    p.stroke(r, g, b, _alpha * 0.4);
                    const angle2 = angle + p.random(-p.PI / 3, p.PI / 3);
                    const x3 = x1 + Math.cos(angle2) * (len * 0.6);
                    const y3 = y1 + Math.sin(angle2) * (len * 0.6);
                    p.line(x1, y1, x3, y3);
                  }
                }
              }

              j += 0.06;
              counter++;

              if (counter % perFrame === 0) {
                yield 1;
              }
            }

            i += 0.01;
          }
        }
      }

      const drawGradientBackground = () => {
        // Spring Sky: Light blue to soft white/green
        let topColor = { r: 180, g: 220, b: 255 }; // Light sky blue
        let bottomColor = { r: 230, g: 245, b: 220 }; // Soft spring green tint
        let midPoint = p.height / 2;

        let gradient = (p.drawingContext as any).createLinearGradient(0, 0, 0, midPoint);
        gradient.addColorStop(0, `rgb(${topColor.r}, ${topColor.g}, ${topColor.b})`);
        gradient.addColorStop(1, `rgb(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b})`);

        (p.drawingContext as any).fillStyle = gradient;
        (p.drawingContext as any).fillRect(0, 0, p.width, midPoint);

        // Fill rest with a soft meadow green
        p.fill(210, 235, 190);
        p.noStroke();
        p.rect(0, midPoint, p.width, p.height - midPoint);

        (p.drawingContext as any).fillStyle = "rgba(0, 0, 0, 0)";
      };

      function* drawScene() {
        drawGradientBackground();

        let cloudGen = drawClouds(4, 1, Math.round(p.width / 4));
        for (let _ of cloudGen) {
          yield 1;
        }

        while (!isDone) {
          let mPoint = initialPoints[currentPointIndex];
          if (!mPoint) {
            isDone = true;
            break;
          }

          updateParticle(mPoint);

          let isNewPoint = handleMountainTransition();

          mPoint = initialPoints[currentPointIndex];
          if (!mPoint) {
            isDone = true;
            break;
          }

          let T = p.PI / 2 + p.map(p.noise(mountainFrameCount * 0.02), 0, 1, -p.PI / 6, p.PI / 6);
          let minAngle = p.map(mountainFrameCount, 0, 400, p.PI / 3, p.PI / 9, true);
          let maxAngle = p.PI - minAngle / 2;
          let midAngle = (minAngle + maxAngle) / 2;
          let angles = generateAngles(T, minAngle, maxAngle, 60);

          let lowestPath: any[] | null = null;
          let highestPath: any[] | null = null;
          let capturePaths = isNewPoint;

          for (let i = 0; i < angles.length; i++) {
            let a = angles[i];
            let isLowest = i === 0;
            let isHighest = i === angles.length - 1;

            let path = drawSegmentedLine(
              mPoint,
              a,
              capturePaths && (isLowest || isHighest),
              T,
              midAngle,
              maxAngle,
              i
            );

            if (capturePaths) {
              if (isLowest) {
                lowestPath = path;
              } else if (isHighest) {
                highestPath = path;
              }
            }
          }

          if (capturePaths && lowestPath && highestPath) {
            drawMountainPolygon(mPoint, lowestPath, highestPath, angles);
          }
          if (mountainFrameCount % 4 === 0) {
            yield 1;
          }
        }
        yield 1;
      }

      p.draw = () => {
        if (!isDone && gen) {
          let v = gen.next();
          if (v.done) {
            isDone = true;
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        // Optionally restart the sketch or handle resize
      };
    };

    const myP5 = new p5(sketch, sketchRef.current!);

    return () => {
      myP5.remove();
    };
  }, []);

  return <div ref={sketchRef} className="w-full h-screen overflow-hidden" />;
};

export default P5Sketch;
