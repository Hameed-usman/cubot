'use server'

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function getDepartmentData(dept: string, section: string) {
  try {
    const filePath = path.join(DATA_DIR, dept, `${section}.txt`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error: any) {
    // If the file doesn't exist, return empty string
    if (error.code === 'ENOENT') {
      return '';
    }
    console.error(`Error reading data for ${dept}/${section}:`, error);
    return '';
  }
}

export async function saveDepartmentData(dept: string, section: string, content: string) {
  try {
    const deptDir = path.join(DATA_DIR, dept);
    
    // Ensure the department directory exists
    try {
      await fs.access(deptDir);
    } catch {
      await fs.mkdir(deptDir, { recursive: true });
    }

    const filePath = path.join(deptDir, `${section}.txt`);
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Error saving data for ${dept}/${section}:`, error);
    return { success: false, error: 'Failed to save data' };
  }
}
