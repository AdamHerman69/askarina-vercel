import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src/data/config.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'askarina2024';

export async function GET() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch {
        return NextResponse.json(
            { error: 'Failed to read config' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const password = searchParams.get('password');

        if (password !== ADMIN_PASSWORD) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        await fs.writeFile(CONFIG_PATH, JSON.stringify(body, null, 4), 'utf-8');

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: 'Failed to save config' },
            { status: 500 }
        );
    }
}
