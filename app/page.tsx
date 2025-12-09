'use client';

import { useState } from 'react';
import { parseExcelFile, Student } from './utils/excel-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, AlertOctagon } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MatchRecord {
  id: string;
  fullNameA: string;
  fullNameB: string;
  locationsA: string[];
  locationsB: string[];
  status: 'ILLEGAL' | 'CONFLICT';
}

export default function Home() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [studentsA, setStudentsA] = useState<Student[]>([]);
  const [studentsB, setStudentsB] = useState<Student[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // Reset results when files change
      setHasChecked(false);
      setMatches([]);
      setError(null);
    }
  };

  const processFiles = async () => {
    if (!fileA || !fileB) {
      setError('Please upload both files.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [dataA, dataB] = await Promise.all([
        parseExcelFile(fileA),
        parseExcelFile(fileB)
      ]);

      setStudentsA(dataA);
      setStudentsB(dataB);

      // Group B students by ID for easy lookup
      const mapB = new Map<string, Student[]>();
      dataB.forEach(s => {
        const key = s.id.toUpperCase();
        if (!mapB.has(key)) {
          mapB.set(key, []);
        }
        mapB.get(key)?.push(s);
      });

      // Group A students by ID to handle duplicates in A
      const mapA = new Map<string, Student[]>();
      dataA.forEach(s => {
        const key = s.id.toUpperCase();
        if (!mapA.has(key)) {
          mapA.set(key, []);
        }
        mapA.get(key)?.push(s);
      });

      const newMatches: MatchRecord[] = [];

      // Iterate through unique IDs in A
      mapA.forEach((studentsInA, id) => {
        if (mapB.has(id)) {
          const studentsInB = mapB.get(id)!;

          // Helper to get first two names normalized
          const getFirstTwoNames = (fullName: string) => {
            return fullName.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
          };

          const nameA = studentsInA[0].fullName;
          const nameB = studentsInB[0].fullName;

          // Compare only the first two names
          const isNameMatch = getFirstTwoNames(nameA) === getFirstTwoNames(nameB);

          // Create a match record
          newMatches.push({
            id: studentsInA[0].id, // Use the ID from the first occurrence
            fullNameA: nameA,
            fullNameB: nameB,
            locationsA: studentsInA.map(s => `[${s.sourceSheet}] Row ${s.rowNumber}`),
            locationsB: studentsInB.map(s => `[${s.sourceSheet}] Row ${s.rowNumber}`),
            status: isNameMatch ? 'ILLEGAL' : 'CONFLICT'
          });
        }
      });

      setMatches(newMatches);
      setHasChecked(true);
    } catch (err) {
      console.error(err);
      setError('Error processing files. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportResults = () => {
    if (matches.length === 0) return;

    const exportData = matches.map(m => ({
      'ID No': m.id,
      'Status': m.status,
      'Name (Cafe)': m.fullNameA,
      'Name (Bank)': m.fullNameB,
      'Found in Group A (Cafe)': m.locationsA.join('; '),
      'Found in Group B (Bank)': m.locationsB.join('; ')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compliance Report");
    XLSX.writeFile(workbook, "compliance_report.xlsx");
  };

  const illegalCount = matches.filter(m => m.status === 'ILLEGAL').length;
  const conflictCount = matches.filter(m => m.status === 'CONFLICT').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Compliance Checker</h1>
          <p className="text-gray-500 text-lg">Identify students registered in Cafe (Group A) who are also receiving Cash Allowance (Group B)</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Group A Input */}
          <Card className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <FileSpreadsheet className="h-5 w-5" />
                Group A (Cafe Users)
              </CardTitle>
              <CardDescription>Upload the list of students registered for cafe meals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFileChange(e, setFileA)}
                  className="cursor-pointer"
                />
                {fileA && <p className="text-sm text-green-600 flex items-center gap-1 mt-1"><CheckCircle className="h-3 w-3" /> {fileA.name}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Group B Input */}
          <Card className="border-t-4 border-t-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <FileSpreadsheet className="h-5 w-5" />
                Group B (Bank/Cash)
              </CardTitle>
              <CardDescription>Upload the list of students receiving cash allowance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFileChange(e, setFileB)}
                  className="cursor-pointer"
                />
                {fileB && <p className="text-sm text-green-600 flex items-center gap-1 mt-1"><CheckCircle className="h-3 w-3" /> {fileB.name}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={processFiles}
            disabled={!fileA || !fileB || isProcessing}
            className="w-full md:w-auto px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
          >
            {isProcessing ? 'Processing...' : 'Check Compliance'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hasChecked && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Cafe Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{studentsA.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Bank Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{studentsB.length}</div>
                </CardContent>
              </Card>
              <Card className={illegalCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Confirmed Illegal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${illegalCount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {illegalCount}
                  </div>
                </CardContent>
              </Card>
              <Card className={conflictCount > 0 ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">ID Conflicts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${conflictCount > 0 ? "text-orange-600" : "text-gray-600"}`}>
                    {conflictCount}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {matches.length > 0
                      ? `Found ${matches.length} matches (${illegalCount} illegal, ${conflictCount} conflicts).`
                      : "No matches found."}
                  </CardDescription>
                </div>
                {matches.length > 0 && (
                  <Button variant="outline" onClick={exportResults} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {matches.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID No</TableHead>
                          <TableHead>Name (Cafe)</TableHead>
                          <TableHead>Name (Bank)</TableHead>
                          <TableHead>Found in Group A</TableHead>
                          <TableHead>Found in Group B</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matches.map((match, index) => (
                          <TableRow key={`${match.id}-${index}`}>
                            <TableCell className="font-medium">{match.id}</TableCell>
                            <TableCell>{match.fullNameA}</TableCell>
                            <TableCell className={match.status === 'CONFLICT' ? 'text-orange-600 font-medium' : ''}>
                              {match.fullNameB}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {match.locationsA.map((loc, i) => (
                                  <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{loc}</span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {match.locationsB.map((loc, i) => (
                                  <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{loc}</span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {match.status === 'ILLEGAL' ? (
                                <Badge variant="destructive">Illegal</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">
                                  ID Conflict
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium">All Clear!</p>
                    <p>No matches found in both lists.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}