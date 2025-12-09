import * as XLSX from 'xlsx';

export interface Student {
    id: string;
    fullName: string;
    sourceSheet: string;
    sourceFile: string;
    rowNumber: number;
    [key: string]: any;
}

export const parseExcelFile = async (file: File): Promise<Student[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                let allStudents: Student[] = [];

                workbook.SheetNames.forEach((sheetName) => {
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                    const students = extractStudentData(jsonData, sheetName, file.name);
                    allStudents = [...allStudents, ...students];
                });

                resolve(allStudents);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

const findHeaderRow = (data: any[][]): number => {
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        // Look for "ID No" or similar in the row
        if (row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes('id no'))) {
            return i;
        }
    }
    return -1;
};

const extractStudentData = (data: any[][], sheetName: string, fileName: string): Student[] => {
    const headerIndex = findHeaderRow(data);
    if (headerIndex === -1) return [];

    const headers = Array.from(data[headerIndex]).map((h: any) => (h ? String(h).trim() : ''));
    const idIndex = headers.findIndex((h: string) => h.toLowerCase().includes('id no'));
    const nameIndex = headers.findIndex((h: string) => h.toLowerCase().includes('full name') || h.toLowerCase().includes('name'));

    if (idIndex === -1) return [];

    const students: Student[] = [];

    for (let i = headerIndex + 1; i < data.length; i++) {
        const row = data[i];
        const id = row[idIndex];

        if (id) {
            const student: Student = {
                id: String(id).trim(),
                fullName: nameIndex !== -1 ? row[nameIndex] : 'Unknown',
                sourceSheet: sheetName,
                sourceFile: fileName,
                rowNumber: i + 1, // 1-based index
            };
            // Capture other fields dynamically
            headers.forEach((header: string, index: number) => {
                if (header && index !== idIndex && index !== nameIndex && row[index] !== undefined) {
                    student[header] = row[index];
                }
            });
            students.push(student);
        }
    }

    return students;
};
