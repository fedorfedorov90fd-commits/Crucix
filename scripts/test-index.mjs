import fs from 'fs/promises';
import path from 'path';

const files = await fs.readdir('/home/ta8_/Рабочий стол/Crucix/apis/sources');
console.log('✅ Найдено файлов:', files.length);
console.log('📁 Файлы:', files.slice(0, 10).join(', '));
