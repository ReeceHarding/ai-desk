const { createCanvas } = require('canvas');
const fs = require('fs');

// Create a 100x100 canvas
const canvas = createCanvas(100, 100);
const ctx = canvas.getContext('2d');

// Draw a white background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 100, 100);

// Draw a simple circle
ctx.beginPath();
ctx.arc(50, 50, 30, 0, Math.PI * 2);
ctx.fillStyle = 'blue';
ctx.fill();

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('__tests__/fixtures/avatar.png', buffer); 