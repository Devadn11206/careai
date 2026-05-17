
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\ddnan\\CAREXAI\\careai\\src\\pages\\DoctorDashboard.tsx', 'utf8');
let open = 0;
let close = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
    const o = (line.match(/\{/g) || []).length;
    const c = (line.match(/\}/g) || []).length;
    open += o;
    close += c;
    if (open < close) {
        console.log(`Error at line ${i + 1}: too many closing braces (${open} vs ${close})`);
        open = close; // reset to avoid noise
    }
});
console.log(`Total Open: ${open}, Total Close: ${close}`);
