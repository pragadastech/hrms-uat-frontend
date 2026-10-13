import React, { useEffect, useRef } from 'react';
import './WeatherBackground.css';

export default function WeatherBackground({ weatherType }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = [];
    let flashOpacity = 0;
    let sunAngle = 0;
    const windStreaks = [];

    const createWindStreak = () => ({
      x: -150 - Math.random() * 100,
      y: Math.random() * height * 0.8,
      length: 80 + Math.random() * 120,
      speed: 3 + Math.random() * 5,
      opacity: 0.05 + Math.random() * 0.15,
    });

    const createRainDrop = () => ({
      x: Math.random() * (width + 100) - 50,
      y: -30 - Math.random() * 20,
      length: 12 + Math.random() * 18,
      speed: 8 + Math.random() * 8,
      angle: 1.5 + Math.random() * 2, 
      opacity: 0.15 + Math.random() * 0.35,
    });

    // Initialize particles
    if (weatherType === 'rainy' || weatherType === 'thunderstorm') {
      const count = weatherType === 'thunderstorm' ? 120 : 70;
      for (let i = 0; i < count; i++) {
        particles.push({
          ...createRainDrop(),
          y: Math.random() * height,
        });
      }
    }

    const windCount = weatherType === 'cloudy' ? 12 : 6;
    for (let i = 0; i < windCount; i++) {
      windStreaks.push({
        ...createWindStreak(),
        x: Math.random() * width,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // --- SUNNY MODE ---
      if (weatherType === 'sunny') {
        sunAngle += 0.0015;
        ctx.save();
        // Position sun near top right
        ctx.translate(width * 0.88, height * 0.22);
        
        // Pulsing core glow
        const glowRadius = 75 + Math.sin(sunAngle * 8) * 8;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        grad.addColorStop(0, 'rgba(253, 224, 71, 0.25)');
        grad.addColorStop(0.4, 'rgba(253, 224, 71, 0.1)');
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Slow rotating sun rays
        ctx.rotate(sunAngle);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.05)';
        ctx.lineWidth = 3;
        const numRays = 10;
        for (let i = 0; i < numRays; i++) {
          ctx.rotate((Math.PI * 2) / numRays);
          ctx.beginPath();
          ctx.moveTo(0, 25);
          ctx.lineTo(0, 110);
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- CLOUDY / WINDY ---
      if (weatherType === 'cloudy' || weatherType === 'rainy' || weatherType === 'thunderstorm') {
        windStreaks.forEach((streak, idx) => {
          ctx.strokeStyle = `rgba(255, 255, 255, ${streak.opacity})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(streak.x, streak.y);
          ctx.lineTo(streak.x + streak.length, streak.y + (weatherType === 'thunderstorm' ? 2 : 0.5));
          ctx.stroke();

          // Move
          streak.x += streak.speed + (weatherType === 'thunderstorm' ? 3 : 1);
          if (streak.x > width + 100) {
            windStreaks[idx] = createWindStreak();
          }
        });
      }

      // --- RAIN / THUNDERSTORM ---
      if (weatherType === 'rainy' || weatherType === 'thunderstorm') {
        ctx.lineWidth = 1.2;
        particles.forEach((drop, idx) => {
          ctx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + drop.angle, drop.y + drop.length);
          ctx.stroke();

          // Move
          drop.y += drop.speed;
          drop.x += drop.angle;

          if (drop.y > height + 20) {
            particles[idx] = createRainDrop();
          }
        });
      }

      // --- LIGHTNING FLASHES ---
      if (weatherType === 'thunderstorm') {
        if (Math.random() < 0.004 && flashOpacity <= 0) {
          flashOpacity = 0.75;
        }

        if (flashOpacity > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
          ctx.fillRect(0, 0, width, height);
          flashOpacity -= 0.04;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [weatherType]);

  return (
    <div className={`weather-bg-container weather-${weatherType}`}>
      <canvas ref={canvasRef} className="weather-canvas" />
      
      {/* CSS-Animated Parallax Clouds */}
      <div className="clouds-layer">
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div className="cloud cloud-3" />
        <div className="cloud cloud-4" />
      </div>
    </div>
  );
}
