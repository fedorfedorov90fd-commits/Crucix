// ============================================================
// CRUCIX ANALYTICS — обёртка для Python-аналитики
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

export async function handleAnalytics(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action') || 'status';

    try {
        const scriptPath = join(__dirname, 'analyzer.py');
        const { stdout, stderr } = await execAsync(`python3 ${scriptPath} --action ${action}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            action: action,
            output: stdout || stderr || 'Аналитика выполнена'
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'error',
            message: error.message
        }));
    }
}

export default { handleAnalytics };
