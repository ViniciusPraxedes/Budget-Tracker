// Declare the client component directive for Next.js
"use client";

// Import React and hooks for state, effect, and references
import React, { useState, useRef } from 'react';
// Import context hook to interact with the budget store
import { useBudget } from '../context/BudgetContext';
// Import styling dictionary from CSS module
import styles from './PDFImportModal.module.css';
// Import PDFJS library to parse documents
import * as pdfjsLib from 'pdfjs-dist';
// Import useLocalization hook to format currency dynamically
import { useLocalization } from '../context/LocalizationContext';
// Import XLSX library to parse spreadsheets
import * as XLSX from 'xlsx';
// Import CreateCategoryModal component
import CreateCategoryModal from './CreateCategoryModal';

// Configure the external PDF worker to parse threads in the client
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';

// Define expected interface structure for a parsed transaction row
interface ParsedTx {
  // Unique identification key
  id: string;
  // Raw date string extracted
  date: string;
  // Extracted day of the month
  paymentDay: number;
  // Month of the transaction (0-indexed)
  month: number;
  // Year of the transaction (4-digit)
  year: number;
  // Description or name of merchant
  description: string;
  // Cost value of transaction
  amount: number;
  // Inclusion status checkbox
  selected: boolean;
  // Target Category key link
  categoryId: string;
  // Transaction type: 'sent' or 'received'
  type: 'sent' | 'received';
}

// Define the property signature for the Modal component
interface PDFImportModalProps {
  // Method callback to dismiss overlay
  onClose: () => void;
}

// Implement the React functional component for bank statement importing
const PDFImportModal: React.FC<PDFImportModalProps> = ({ onClose }) => {
  // Get active categories list, addExpenses, addMissingCategories, pdfConfig, updatePDFConfig, currentMonth, and currentYear helper from context
  const { categories, addExpenses, addMissingCategories, pdfConfig, updatePDFConfig, currentMonth, currentYear } = useBudget();
  // Get formatCurrency helper function from localization hook context
  const { formatCurrency } = useLocalization();
  // Manage file drag-over hover state
  const [dragActive, setDragActive] = useState(false);
  // Manage background loading processing state
  const [loading, setLoading] = useState(false);
  // Manage list of parsed transactions state
  const [transactions, setTransactions] = useState<ParsedTx[]>([]);
  // Manage status log or helper message strings
  const [statusMessage, setStatusMessage] = useState('');
  // Reference hook to reference hidden input picker
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Manage current wizard step (1: Load, 2: Select, 3: Configure)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Manage text search filter query string
  const [searchQuery, setSearchQuery] = useState('');
  // State to track category creation trigger source type and identifier
  const [activeCreateCategoryTrigger, setActiveCreateCategoryTrigger] = useState<{ type: 'merchant' | 'new_map' | 'saved_map'; key: string } | null>(null);
  // Manage collapse state of the saved category mappings section in settings
  const [mappingsCollapsed, setMappingsCollapsed] = useState(true);
  // Manage collapse state of the ignored merchants skip list section in settings
  const [ignoredCollapsed, setIgnoredCollapsed] = useState(true);
  // Manage visibility status of the erase configurations confirmation modal
  const [showConfirmErase, setShowConfirmErase] = useState(false);

  // Manage transaction selection filter status
  const [filterStatus, setFilterStatus] = useState<'all' | 'selected' | 'unselected' | 'unmapped' | 'received' | 'sent'>('all');
  // State for new inline mapping name text input field
  const [newMapName, setNewMapName] = useState('');
  // State for new inline mapping category selection dropdown
  const [newMapCat, setNewMapCat] = useState('');
  // State for new inline ignore rule name text input field
  const [newIgnoreName, setNewIgnoreName] = useState('');
  // Manage list of unique retrieved transaction names from settings PDF import
  const [retrievedNames, setRetrievedNames] = useState<string[]>([]);
  // Manage confirmation modal display state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Manage loading state for settings PDF import
  const [settingsLoading, setSettingsLoading] = useState(false);
  // Manage drag active state for settings PDF import
  const [settingsDragActive, setSettingsDragActive] = useState(false);
  // Reference hook to reference hidden settings input file picker
  const settingsFileInputRef = useRef<HTMLInputElement>(null);

  // Trigger hook to verify and create default categories on mount
  React.useEffect(() => {
    // Define standard categories to verify
    const defaultCats = [
      // Housing default details
      { name: 'Housing', color: '#FF5722' },
      // Food default details
      { name: 'Food', color: '#4CAF50' },
      // Transportation default details
      { name: 'Transportation', color: '#2196F3' },
      // Entertainment default details
      { name: 'Entertainment', color: '#9C27B0' }
    ];
    // Filter down to categories that do not exist yet
    const missing = defaultCats.filter((def) => 
      // Compare lowercased category name strings
      !categories.some((cat) => cat.name.toLowerCase() === def.name.toLowerCase())
    );
    // If any necessary categories are missing
    if (missing.length > 0) {
      // Trigger batch categories creation helper
      addMissingCategories(missing);
    }
  // Register category collection and addition callbacks dependency keys
  }, [categories, addMissingCategories]);

  // Trigger helper to match categories based on name matching
  const findMatchingCategory = (desc: string): string => {
    // Convert target description to lowercase
    const search = desc.toLowerCase();
    // Define keyword mappings for standard category names
    const keywordMappings: { [key: string]: string[] } = {
      // Food keywords
      'Food': ['hemkop', 'coop', 'ica', 'hono', 'doner', 'normal', 'mcdonald', 'burger', 'kebab', 'restaurant', 'cafe', 'starbucks', 'gotapett', 'food', 'mat', 'bageri'],
      // Transportation keywords
      'Transportation': ['västtrafik', 'vasttrafik', 'sj', 'västtr', 'vasttr', 'taxi', 'uber', 'bolt', 'gas', 'diesel', 'q8', 'circle k', 'shell', 'transit', 'billetto'],
      // Entertainment keywords
      'Entertainment': ['g2a', 'netflix', 'spotify', 'apple.com', 'google', 'xbox', 'microsoft', 'disn', 'hbomax', 'udemy', 'nordicwell', 'wellness', 'gym', 'ticket', 'steam', 'playstation', 'nintendo', 'gaming', 'cinema', 'movie', 'amazon prime', 'disney'],
      // Housing keywords
      'Housing': ['unionen', 'vimla', 'frisktandv', 'csn', 'capio', 'tele2', 'telenor', 'tre', 'halebop', 'elavtal', 'hyra', 'rent', 'domain', 'squarespace', 'sqsp', 'clas ohlson', 'utilit', 'internet']
    };
    // Loop through keyword mappings
    for (const [catName, keywords] of Object.entries(keywordMappings)) {
      // Check if any keyword matches the search query, with special handling for internet utility transfers
      if (keywords.some((kw) => {
        // Skip matching if keyword is internet but description refers to a transfer
        if (kw === 'internet' && (search.includes('överföring') || search.includes('overforing') || search.includes('transfer'))) {
          // Do not match this keyword
          return false;
        // Close conditional block for internet transfer check
        }
        // Match if the search text contains the keyword
        return search.includes(kw);
      // Close keyword verification check
      })) {
        // Find existing category matching mapped name
        const match = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        // Return category identifier if found
        if (match) return match.id;
      // Close condition check
      }
    }
    // Loop through list of existing categories
    for (const cat of categories) {
      // Convert current category name to lowercase
      const catName = cat.name.toLowerCase();
      // Check if description includes category name or vice versa
      if (search.includes(catName) || catName.includes(search)) {
        // Return matching category identifier
        return cat.id;
      }
    }
    // Return empty string as fallback indicating unmapped
    return '';
  };

  // Helper to parse year, month (0-indexed), and day from date string
  const parseDateParts = (dateStr: string): { year: number; month: number; day: number } => {
    // Match numeric segments in the date string
    const parts = dateStr.match(/\d+/g);
    // Return default values if segments count is insufficient
    if (!parts || parts.length < 3) {
      // Fallback object representation
      return { year: currentYear, month: currentMonth, day: 1 };
    }
    // Parse first segment
    const p0 = parseInt(parts[0]);
    // Parse second segment
    const p1 = parseInt(parts[1]);
    // Parse third segment
    const p2 = parseInt(parts[2]);
    // Check if first segment is 4-digit year
    if (parts[0].length === 4) {
      // YYYY-MM-DD format
      return { year: p0, month: p1 - 1, day: p2 };
    }
    // Check if third segment is 4-digit year
    if (parts[2].length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY format (assume European style DD-MM-YYYY)
      return { year: p2, month: p1 - 1, day: p0 };
    }
    // Check if first segment is 2-digit year (assume YY-MM-DD)
    if (p0 < 100) {
      // YY-MM-DD format
      return { year: 2000 + p0, month: p1 - 1, day: p2 };
    }
    // Fallback default
    return { year: currentYear, month: currentMonth, day: 1 };
  };

  // Helper to parse CSV format statement text
  const parseCsv = async (csvText: string) => {
    // Set processing loading state to true
    setLoading(true);
    // Display parsing document label message
    setStatusMessage('Reading CSV statement...');
    // Wrap CSV parsing in try-catch to handle errors safely
    try {
      // Split raw text lines by carriage return and newline characters
      const lines = csvText.split(/\r?\n/);
      // Verify file contains at least header and one data row
      if (lines.length < 2) {
        // Throw format error if rows count is insufficient
        throw new Error('CSV file has too few rows.');
      }
      // Default CSV separator field delimiter to comma
      let delimiter = ',';
      // Find the header row index by scanning the first few lines
      let headerRowIdx = 0;
      // Define list of header keywords to detect the header line
      const detectionKeywords = ['date', 'datum', 'bokföring', 'transaktion', 'amount', 'belopp', 'summa', 'värde', 'referens', 'beskrivning'];
      // Helper function to parse single CSV line supporting quotes
      const parseCsvLine = (lineStr: string, delimChar: string) => {
        // Initialize empty array of parsed columns
        const colList: string[] = [];
        // Accumulator string for current cell value
        let curCell = '';
        // Toggle flag indicating quote nesting state
        let inQuotes = false;
        // Loop character by character through the line
        for (let idx = 0; idx < lineStr.length; idx++) {
          // Read current character from index position
          const char = lineStr[idx];
          // Check for quote character
          if (char === '"') {
            // Toggle inside quotes boolean value
            inQuotes = !inQuotes;
          }
          // Check for delimiter character outside quotes
          else if (char === delimChar && !inQuotes) {
            // Push trimmed accumulator string to columns list
            colList.push(curCell.trim());
            // Reset cell accumulator string
            curCell = '';
          }
          // Otherwise append character
          else {
            // Append character to cell value
            curCell += char;
          }
        }
        // Push final column to list
        colList.push(curCell.trim());
        // Return parsed columns array
        return colList;
      };
      // Initialize best header row index
      headerRowIdx = 0;
      // Initialize best date column index
      let dateIdx = -1;
      // Initialize best description column index
      let descIdx = -1;
      // Initialize best amount column index
      let amountIdx = -1;
      // Keep track of the highest match score found
      let maxScore = -1;
      // Define list of date column header keywords
      const dateKeywords = ['date', 'datum', 'bokf', 'transaktionsdag', 'valutadag', 'transaktion'];
      // Define list of description column header keywords
      const descKeywords = ['beskrivning', 'desc', 'description', 'merchant', 'mottagare', 'namn', 'text', 'referens', 'detaljer'];
      // Define list of amount column header keywords
      const amountKeywords = ['amount', 'belopp', 'summa', 'värde'];
      // Loop first 15 lines to locate the header row and determine the delimiter
      for (let idx = 0; idx < Math.min(15, lines.length); idx++) {
        // Read current line text
        const lineText = lines[idx];
        // If line is empty or starts with a Swedish bank export comment indicator
        if (!lineText.trim() || lineText.trim().startsWith('*')) {
          // Continue to next line
          continue;
        }
        // Temp delimiter guess based on counts in the row
        let tempDelim = ',';
        // Semicolon check
        if (lineText.includes(';')) {
          // Set temp delimiter
          tempDelim = ';';
        }
        // Tab check
        else if (lineText.includes('\t')) {
          // Set temp delimiter
          tempDelim = '\t';
        }
        // Parse the line using temp delimiter guess
        const cols = parseCsvLine(lineText, tempDelim);
        // Temp index for date
        let tempDateIdx = -1;
        // Temp index for description
        let tempDescIdx = -1;
        // Temp index for amount
        let tempAmountIdx = -1;
        // Score for current line
        let lineScore = 0;
        // Loop through the parsed columns of the line
        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
          // Convert column value to lowercase string
          const val = cols[cIdx].toLowerCase();
          // Check matching date keyword
          if (tempDateIdx === -1 && dateKeywords.some((kw) => val.includes(kw))) {
            // Set temp index
            tempDateIdx = cIdx;
          }
          // Check matching description keyword
          if (descKeywords.some((kw) => val.includes(kw))) {
            // Prioritize higher precision matches (e.g. description/beskrivning over reference/referens)
            const isHighPriority = ['beskrivning', 'description', 'desc'].some((kw) => val.includes(kw));
            // If we don't have a match yet, or if this is a high-priority match while the existing one is low-priority
            const currentIsLowPriority = tempDescIdx !== -1 && !['beskrivning', 'description', 'desc'].some((kw) => cols[tempDescIdx].toLowerCase().includes(kw));
            // Apply prioritization updates
            if (tempDescIdx === -1 || (isHighPriority && currentIsLowPriority)) {
              // Set temp index
              tempDescIdx = cIdx;
            }
          }
          // Check matching amount keyword
          if (tempAmountIdx === -1 && amountKeywords.some((kw) => val.includes(kw))) {
            // Set temp index
            tempAmountIdx = cIdx;
          }
        }
        // Calculate score based on found columns
        if (tempDateIdx !== -1) {
          // Increment score
          lineScore += 1;
        }
        // Check description column
        if (tempDescIdx !== -1) {
          // Increment score
          lineScore += 1;
        }
        // Check amount column
        if (tempAmountIdx !== -1) {
          // Increment score
          lineScore += 1;
        }
        // If current line score is higher than max score
        if (lineScore > maxScore) {
          // Set new max score
          maxScore = lineScore;
          // Set resolved delimiter
          delimiter = tempDelim;
          // Set resolved header row index
          headerRowIdx = idx;
          // Set resolved column indices
          dateIdx = tempDateIdx;
          // Set resolved description index
          descIdx = tempDescIdx;
          // Set resolved amount index
          amountIdx = tempAmountIdx;
        }
      }
      // Use fallback first column index for date if not resolved
      if (dateIdx === -1) {
        // Assign default index zero
        dateIdx = 0;
      }
      // Use fallback second column index for description if not resolved
      if (descIdx === -1) {
        // Assign default index one
        descIdx = 1;
      }
      // Use fallback third column index for amount if not resolved
      if (amountIdx === -1) {
        // Assign default index two
        amountIdx = 2;
      }
      // Initialize temporary array to store parsed transactions
      const parsedRows: ParsedTx[] = [];
      // Loop over data rows after header index
      for (let rowIdx = headerRowIdx + 1; rowIdx < lines.length; rowIdx++) {
        // Read current row line text
        const lineText = lines[rowIdx];
        // Skip current line if it is blank or whitespace
        if (!lineText.trim()) {
          // Continue loop
          continue;
        }
        // Parse row line columns
        const cols = parseCsvLine(lineText, delimiter);
        // Skip current row if column size is less than required indexes
        if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) {
          // Continue loop
          continue;
        }
        // Extract raw date cell value
        const rawDate = cols[dateIdx];
        // Extract raw description cell value
        const rawDesc = cols[descIdx];
        // Extract raw amount cell value
        const rawAmount = cols[amountIdx];
        // Match standard calendar date formats
        const dateMatch = rawDate.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
        // Skip row if no valid date pattern matched
        if (!dateMatch) {
          // Continue loop
          continue;
        }
        // Parse date segments using helper
        const { year: parsedYear, month: parsedMonth, day: parsedDay } = parseDateParts(dateMatch[0]);
        // Clean spaces and replace decimal comma with dot
        const cleanAmtStr = rawAmount.replace(/\s/g, '').replace(/,/g, '.');
        // Parse float value from cleaned string representation
        const amountVal = parseFloat(cleanAmtStr);
        // Skip row if parsing resulted in non-numeric values
        if (isNaN(amountVal)) {
          // Continue loop
          continue;
        }
        // Clean description text
        const cleanDesc = rawDesc.replace(/\s+/g, ' ').trim() || 'CSV Transaction';
        // Check saved mappings configuration
        const rawSavedCategoryId = pdfConfig?.mappings[cleanDesc];
        // Validate saved category ID still exists in the current categories list
        const savedCategoryId = rawSavedCategoryId && categories.some((c) => c.id === rawSavedCategoryId) ? rawSavedCategoryId : undefined;
        // Check saved ignored configuration
        const isIgnored = pdfConfig?.ignored.includes(cleanDesc);
        // Check transaction type based on original amountVal sign
        const txType = amountVal < 0 ? 'sent' : 'received';
        // Push transactions data to parsed list
        parsedRows.push({
          // Generate unique ID string
          id: Math.random().toString(36).substr(2, 9),
          // Set date
          date: dateMatch[0],
          // Set payment day constrained between 1 and 31
          paymentDay: Math.min(Math.max(parsedDay, 1), 31),
          // Set parsed month
          month: parsedMonth,
          // Set parsed year
          year: parsedYear,
          // Set description
          description: cleanDesc,
          // Set absolute amount value
          amount: Math.abs(amountVal),
          // Set selected state — deselect received (income) transactions by default
          selected: !isIgnored && txType === 'sent',
          // Assign resolved category ID
          categoryId: savedCategoryId || findMatchingCategory(cleanDesc),
          // Assign transaction type
          type: txType
        });
      }
      // Update transactions state list
      setTransactions(parsedRows);
      // Set status message text helper
      setStatusMessage(`Found ${parsedRows.length} transaction entries.`);
      // If transactions were found, move to Step 2
      if (parsedRows.length > 0) {
        setStep(2);
      }
    }
    // Catch parsing error and display to user
    catch (err) {
      // Print error logs
      console.error(err);
      // Set status error message
      setStatusMessage('Error parsing CSV. Please verify file format.');
    }
    // Terminate loading indicator
    finally {
      // Toggle loading to false
      setLoading(false);
    }
  };
  // Helper function to dynamically recalculate range for sheets with incorrect dimensions
  const fixSheetRange = (sheet: XLSX.WorkSheet) => {
    // Keep track of maximum row index found
    let maxRow = 0;
    // Keep track of maximum column index found
    let maxCol = 0;
    // Loop through all keys in the sheet object
    for (const key of Object.keys(sheet)) {
      // Ignore keys starting with exclamation point representing metadata
      if (key.startsWith('!')) continue;
      // Match coordinate syntax identifying column letters and row number
      const match = key.match(/^([A-Z]+)(\d+)$/);
      // Check if matching coordinate pattern resolved
      if (match) {
        // Extract column letter string segment
        const colStr = match[1];
        // Parse row number integer segment
        const rowNum = parseInt(match[2], 10);
        // Initialize column index accumulator
        let colIdx = 0;
        // Loop character by character through the column letters
        for (let i = 0; i < colStr.length; i++) {
          // Accumulate index base 26 conversion
          colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
        }
        // Subtract offset for 0-indexed column column mapping
        colIdx = colIdx - 1;
        // Subtract offset for 0-indexed row mapping
        const rowIdx = rowNum - 1;
        // Check if row index exceeds maximum row
        if (rowIdx > maxRow) maxRow = rowIdx;
        // Check if column index exceeds maximum column
        if (colIdx > maxCol) maxCol = colIdx;
      }
    }
    // Set corrected range metadata property using XLSX library encoder utility
    sheet['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol, r: maxRow } });
  };

  // Helper to parse Excel format statement
  const parseExcel = async (arrayBuffer: ArrayBuffer) => {
    // Set loading indicator state to true
    setLoading(true);
    // Display parsing document label message
    setStatusMessage('Reading Excel statement...');
    // Wrap Excel parsing in try-catch to handle errors safely
    try {
      // Read Excel workbook using XLSX library
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // Get first sheet name
      const sheetName = workbook.SheetNames[0];
      // Get worksheet object
      const sheet = workbook.Sheets[sheetName];
      // Recalculate sheet dimensions to fix potentially truncated reference ranges
      fixSheetRange(sheet);
      // Convert sheet to JSON rows array of arrays
      const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      // Verify sheet contains data rows
      if (jsonData.length < 2) {
        // Throw error on empty worksheet
        throw new Error('Excel sheet is empty.');
      }
      // Initialize best header row index
      let headerRowIdx = 0;
      // Initialize best date column index
      let dateIdx = -1;
      // Initialize best description column index
      let descIdx = -1;
      // Initialize best amount column index
      let amountIdx = -1;
      // Keep track of the highest match score found
      let maxScore = -1;
      // Define list of date column header keywords
      const dateKeywords = ['date', 'datum', 'bokf', 'transaktionsdag', 'valutadag', 'transaktion'];
      // Define list of description column header keywords
      const descKeywords = ['beskrivning', 'desc', 'description', 'merchant', 'mottagare', 'namn', 'text', 'referens', 'detaljer'];
      // Define list of amount column header keywords
      const amountKeywords = ['amount', 'belopp', 'summa', 'värde', 'belo'];
      // Search first fifteen rows for headers
      for (let rIdx = 0; rIdx < Math.min(15, jsonData.length); rIdx++) {
        // Read current row array
        const row = jsonData[rIdx];
        // Skip current row if empty
        if (!row) {
          // Continue loop
          continue;
        }
        // Temp index for date
        let tempDateIdx = -1;
        // Temp index for description
        let tempDescIdx = -1;
        // Temp index for amount
        let tempAmountIdx = -1;
        // Score for current row
        let rowScore = 0;
        // Loop through column cell values
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          // Convert cell value to lowercase string
          const val = String(row[cIdx] || '').toLowerCase();
          // Check matching date keyword
          if (tempDateIdx === -1 && dateKeywords.some((kw) => val.includes(kw))) {
            // Set temp index
            tempDateIdx = cIdx;
          }
          // Check matching description keyword
          if (descKeywords.some((kw) => val.includes(kw))) {
            // Prioritize higher precision matches (e.g. description/beskrivning over reference/referens)
            const isHighPriority = ['beskrivning', 'description', 'desc'].some((kw) => val.includes(kw));
            // If we don't have a match yet, or if this is a high-priority match while the existing one is low-priority
            const currentIsLowPriority = tempDescIdx !== -1 && !['beskrivning', 'description', 'desc'].some((kw) => String(row[tempDescIdx] || '').toLowerCase().includes(kw));
            // Apply prioritization updates
            if (tempDescIdx === -1 || (isHighPriority && currentIsLowPriority)) {
              // Set temp index
              tempDescIdx = cIdx;
            }
          }
          // Check matching amount keyword
          if (tempAmountIdx === -1 && amountKeywords.some((kw) => val.includes(kw))) {
            // Set temp index
            tempAmountIdx = cIdx;
          }
        }
        // Calculate score based on found columns
        if (tempDateIdx !== -1) {
          // Increment score
          rowScore += 1;
        }
        // Check description column
        if (tempDescIdx !== -1) {
          // Increment score
          rowScore += 1;
        }
        // Check amount column
        if (tempAmountIdx !== -1) {
          // Increment score
          rowScore += 1;
        }
        // If current row score is higher than max score
        if (rowScore > maxScore) {
          // Set new max score
          maxScore = rowScore;
          // Set resolved header row index
          headerRowIdx = rIdx;
          // Set resolved column indices
          dateIdx = tempDateIdx;
          // Set resolved description index
          descIdx = tempDescIdx;
          // Set resolved amount index
          amountIdx = tempAmountIdx;
        }
      }
      // Use fallback first column index for date if not resolved
      if (dateIdx === -1) {
        // Assign default index zero
        dateIdx = 0;
      }
      // Use fallback second column index for description if not resolved
      if (descIdx === -1) {
        // Assign default index one
        descIdx = 1;
      }
      // Use fallback third column index for amount if not resolved
      if (amountIdx === -1) {
        // Assign default index two
        amountIdx = 2;
      }
      // Initialize temporary array to store parsed transactions
      const parsedRows: ParsedTx[] = [];
      // Loop over data rows after header index
      for (let rIdx = headerRowIdx + 1; rIdx < jsonData.length; rIdx++) {
        // Read row array data
        const row = jsonData[rIdx];
        // Skip row if columns count is insufficient
        if (!row || row.length <= Math.max(dateIdx, descIdx, amountIdx)) {
          // Continue loop
          continue;
        }
        // Extract raw date cell value
        const rawDate = row[dateIdx];
        // Extract raw description cell value
        const rawDesc = row[descIdx];
        // Extract raw amount cell value
        const rawAmount = row[amountIdx];
        // Skip row if any required field value is missing
        if (!rawDate || !rawDesc || rawAmount === undefined) {
          // Continue loop
          continue;
        }
        // Initialize date string
        let dateStr = '';
        // Default payment day value
        let payDay = 1;
        // Check if raw date is number (Excel serial format)
        if (typeof rawDate === 'number') {
          // Convert Excel numeric date value
          const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
          // Format date as ISO string segment
          dateStr = dateObj.toISOString().split('T')[0];
          // Get day from date object
          payDay = dateObj.getDate();
        }
        // Otherwise parse string date format
        else {
          // Convert value to string representation
          dateStr = String(rawDate);
          // Match standard calendar date formats
          const dateMatch = dateStr.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/);
          // If date matches regex
          if (dateMatch) {
            // Assign date string to matched segment
            dateStr = dateMatch[0];
          }
        }
        // Parse date segments using helper
        const { year: parsedYear, month: parsedMonth, day: parsedDay } = parseDateParts(dateStr);
        // Clean spaces and parse float value from amount
        const amountVal = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/\s/g, '').replace(/,/g, '.'));
        // Skip row if parsing resulted in non-numeric values
        if (isNaN(amountVal)) {
          // Continue loop
          continue;
        }
        // Clean description text representation
        const cleanDesc = String(rawDesc).replace(/\s+/g, ' ').trim() || 'Excel Transaction';
        // Check saved mappings configuration
        const rawSavedCategoryId2 = pdfConfig?.mappings[cleanDesc];
        // Validate saved category ID still exists in the current categories list
        const savedCategoryId = rawSavedCategoryId2 && categories.some((c) => c.id === rawSavedCategoryId2) ? rawSavedCategoryId2 : undefined;
        // Check saved ignored configuration
        const isIgnored = pdfConfig?.ignored.includes(cleanDesc);
        // Check transaction type based on original amountVal sign
        const txType = amountVal < 0 ? 'sent' : 'received';
        // Push transactions data to parsed list
        parsedRows.push({
          // Generate unique ID string
          id: Math.random().toString(36).substr(2, 9),
          // Set date
          date: dateStr,
          // Set payment day constrained between 1 and 31
          paymentDay: Math.min(Math.max(parsedDay, 1), 31),
          // Set parsed month
          month: parsedMonth,
          // Set parsed year
          year: parsedYear,
          // Set description
          description: cleanDesc,
          // Set absolute amount value
          amount: Math.abs(amountVal),
          // Set selected state — deselect received (income) transactions by default
          selected: !isIgnored && txType === 'sent',
          // Assign resolved category ID
          categoryId: savedCategoryId || findMatchingCategory(cleanDesc),
          // Assign transaction type
          type: txType
        });
      }
      // Update transactions state list
      setTransactions(parsedRows);
      // Set status message text helper
      setStatusMessage(`Found ${parsedRows.length} transaction entries.`);
      // If transactions were found, move to Step 2
      if (parsedRows.length > 0) {
        setStep(2);
      }
    }
    // Catch parsing error and display to user
    catch (err) {
      // Print error logs
      console.error(err);
      // Set status error message
      setStatusMessage('Error parsing Excel. Please verify file format.');
    }
    // Terminate loading indicator
    finally {
      // Toggle loading to false
      setLoading(false);
    }
  };

  // Unify processing logic for all file types
  const processFile = (file: File) => {
    // Get file name string in lowercase
    const name = file.name.toLowerCase();
    // Create new standard file reader
    const reader = new FileReader();
    // Check if file is CSV
    if (name.endsWith('.csv')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is string
        if (typeof event.target?.result === 'string') {
          // Parse loaded CSV details
          await parseCsv(event.target.result);
        }
      };
      // Load file as text using ISO-8859-1 encoding to support Swedish characters
      reader.readAsText(file, 'ISO-8859-1');
    }
    // Check if file is Excel
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is array buffer
        if (event.target?.result instanceof ArrayBuffer) {
          // Parse loaded Excel details
          await parseExcel(event.target.result);
        }
      };
      // Load file as array buffer data
      reader.readAsArrayBuffer(file);
    }
    // Check if file is PDF
    else if (name.endsWith('.pdf')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is array buffer
        if (event.target?.result instanceof ArrayBuffer) {
          // Parse loaded PDF details
          await parsePdf(event.target.result);
        }
      };
      // Load file as array buffer data
      reader.readAsArrayBuffer(file);
    }
    // If format is not supported
    else {
      // Display error message
      setStatusMessage('Unsupported file format. Please upload a PDF, CSV, or Excel file.');
    }
  };

  // Helper to parse CSV for names in settings
  const parseCsvForNames = (csvText: string) => {
    // Wrap CSV parsing in try-catch to handle errors safely
    try {
      // Split raw text lines by carriage return and newline characters
      const lines = csvText.split(/\r?\n/);
      // Return early if file contains too few rows
      if (lines.length < 2) {
        // Exit function
        return;
      }
      // Default CSV separator field delimiter to comma
      let delimiter = ',';
      // Find the header row index by scanning the first few lines
      let headerRowIdx = 0;
      // Define list of header keywords to detect the header line
      const detectionKeywords = ['date', 'datum', 'bokföring', 'transaktion', 'amount', 'belopp', 'summa', 'värde', 'referens', 'beskrivning'];
      // Helper function to parse single CSV line supporting quotes
      const parseCsvLine = (lineStr: string, delimChar: string) => {
        // Initialize empty array of parsed columns
        const colList: string[] = [];
        // Accumulator string for current cell value
        let curCell = '';
        // Toggle flag indicating quote nesting state
        let inQuotes = false;
        // Loop character by character through the line
        for (let idx = 0; idx < lineStr.length; idx++) {
          // Read current character from index position
          const char = lineStr[idx];
          // Check for quote character
          if (char === '"') {
            // Toggle inside quotes boolean value
            inQuotes = !inQuotes;
          }
          // Check for delimiter character
          else if (char === delimChar && !inQuotes) {
            // Push trimmed value
            colList.push(curCell.trim());
            // Reset accumulator
            curCell = '';
          }
          // Otherwise append character
          else {
            // Append character
            curCell += char;
          }
        }
        // Push final column
        colList.push(curCell.trim());
        // Return parsed columns array
        return colList;
      };
      // Loop first 10 lines to detect delimiter and locate the header row
      for (let idx = 0; idx < Math.min(10, lines.length); idx++) {
        // Read current line text
        const lineText = lines[idx];
        // If line is empty or starts with a Swedish bank export comment indicator
        if (!lineText.trim() || lineText.trim().startsWith('*')) {
          // Continue to next line
          continue;
        }
        // Temp delimiter guess based on counts in the row
        let tempDelim = ',';
        // Semicolon check
        if (lineText.includes(';')) {
          // Set temp delimiter
          tempDelim = ';';
        }
        // Tab check
        else if (lineText.includes('\t')) {
          // Set temp delimiter
          tempDelim = '\t';
        }
        // Parse the line using temp delimiter guess
        const cols = parseCsvLine(lineText, tempDelim);
        // Check if any column contains detection keywords
        const isHeader = cols.some((col) => 
          // Match keywords case-insensitively
          detectionKeywords.some((kw) => col.toLowerCase().includes(kw))
        );
        // If it looks like a header row
        if (isHeader) {
          // Set resolved delimiter
          delimiter = tempDelim;
          // Set resolved header row index
          headerRowIdx = idx;
          // Exit search loop
          break;
        }
      }
      // Parse headers in lowercase
      const headers = parseCsvLine(lines[headerRowIdx], delimiter).map((h) => h.toLowerCase());
      // Initialize description index
      let descIdx = -1;
      // Define list of description keywords
      const descKeywords = ['beskrivning', 'desc', 'description', 'merchant', 'mottagare', 'namn', 'text', 'referens', 'detaljer'];
      // Loop headers to match description index
      for (let idx = 0; idx < headers.length; idx++) {
        // Match description keyword
        if (descIdx === -1 && descKeywords.some((kw) => headers[idx].includes(kw))) {
          // Assign index
          descIdx = idx;
        }
      }
      // Fallback index default one
      if (descIdx === -1) {
        // Assign default index
        descIdx = 1;
      }
      // Set to hold unique description names
      const namesSet = new Set<string>();
      // Loop data lines
      for (let rowIdx = headerRowIdx + 1; rowIdx < lines.length; rowIdx++) {
        // Read line text
        const lineText = lines[rowIdx];
        // Skip blank lines
        if (!lineText.trim()) {
          // Continue loop
          continue;
        }
        // Parse columns list
        const cols = parseCsvLine(lineText, delimiter);
        // Verify index size
        if (cols.length > descIdx) {
          // Add name to set
          namesSet.add(cols[descIdx]);
        }
      }
      // Populate unique name list values
      setRetrievedNames(Array.from(namesSet));
    }
    // Catch errors
    catch (e) {
      // Print error logs
      console.error(e);
    }
  };

  // Helper to parse Excel for names in settings
  const parseExcelForNames = (arrayBuffer: ArrayBuffer) => {
    // Wrap Excel parsing in try-catch to handle errors safely
    try {
      // Read workbook array buffer
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // Get first sheet name
      const sheetName = workbook.SheetNames[0];
      // Get worksheet object
      const sheet = workbook.Sheets[sheetName];
      // Recalculate sheet dimensions to fix potentially truncated reference ranges
      fixSheetRange(sheet);
      // Convert sheet to JSON rows as 2D array
      const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      // Return if empty
      if (jsonData.length < 2) {
        // Exit function
        return;
      }
      // Initialize description index
      let descIdx = -1;
      // Define description keywords
      const descKeywords = ['beskrivning', 'desc', 'description', 'merchant', 'mottagare', 'namn', 'text', 'referens', 'detaljer'];
      // Initialize header row index
      let headerRowIdx = 0;
      // Search first fifteen rows for headers
      for (let rIdx = 0; rIdx < Math.min(15, jsonData.length); rIdx++) {
        // Read row
        const row = jsonData[rIdx];
        // Skip empty rows
        if (!row) {
          // Continue loop
          continue;
        }
        // Loop columns
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          // Convert cell value to string
          const val = String(row[cIdx] || '').toLowerCase();
          // Match description
          if (descIdx === -1 && descKeywords.some((kw) => val.includes(kw))) {
            // Assign index
            descIdx = cIdx;
            // Set header row index
            headerRowIdx = rIdx;
          }
        }
      }
      // Fallback index
      if (descIdx === -1) {
        // Assign default index
        descIdx = 1;
      }
      // Set to hold unique description names
      const namesSet = new Set<string>();
      // Loop over data rows after headers
      for (let rIdx = headerRowIdx + 1; rIdx < jsonData.length; rIdx++) {
        // Read row data
        const row = jsonData[rIdx];
        // Check row and column exists
        if (row && row.length > descIdx && row[descIdx] !== undefined) {
          // Add to set
          namesSet.add(String(row[descIdx]).trim());
        }
      }
      // Populate unique name list values
      setRetrievedNames(Array.from(namesSet));
    }
    // Catch errors
    catch (e) {
      // Print error logs
      console.error(e);
    }
  };

  // Unify settings processing logic for all file types
  const processSettingsFile = (file: File) => {
    // Get file name string in lowercase
    const name = file.name.toLowerCase();
    // Create new standard file reader
    const reader = new FileReader();
    // Check if file is CSV
    if (name.endsWith('.csv')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is string
        if (typeof event.target?.result === 'string') {
          // Parse loaded CSV for names
          parseCsvForNames(event.target.result);
        }
      };
      // Load file as text using ISO-8859-1 encoding to support Swedish characters
      reader.readAsText(file, 'ISO-8859-1');
    }
    // Check if file is Excel
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is array buffer
        if (event.target?.result instanceof ArrayBuffer) {
          // Parse loaded Excel for names
          parseExcelForNames(event.target.result);
        }
      };
      // Load file as array buffer data
      reader.readAsArrayBuffer(file);
    }
    // Check if file is PDF
    else if (name.endsWith('.pdf')) {
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is array buffer
        if (event.target?.result instanceof ArrayBuffer) {
          // Parse loaded PDF for names
          await parsePdfForNames(event.target.result);
        }
      };
      // Load file as array buffer data
      reader.readAsArrayBuffer(file);
    }
  };

  // Process transaction extraction from file buffer array
  const parsePdf = async (arrayBuffer: ArrayBuffer) => {
    // Set processing loading states
    setLoading(true);
    // Display parsing document label
    setStatusMessage('Reading PDF statement...');
    // Attempt parsing sequence
    try {
      // Load document task with PDF.js array data
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      // Resolve promise to extract PDF document API object
      const pdf = await loadingTask.promise;
      // Initialize full raw text accumulator
      let fullText = '';
      // Loop through every page index in document
      for (let i = 1; i <= pdf.numPages; i++) {
        // Retrieve PDF page handler object
        const page = await pdf.getPage(i);
        // Get text content items array
        const textContent = await page.getTextContent();
        // Group items by Y coordinate
        const rows: { [key: number]: any[] } = {};
        // Set tolerance threshold for grouping nearby Y values
        const tolerance = 4;
        // Loop through text block elements
        for (const item of textContent.items) {
          // Verify item object structure contains string
          if ('str' in item) {
            // Trim whitespace
            const text = item.str.trim();
            // Skip empty text segments
            if (!text) continue;
            // Get X coordinate
            const x = item.transform[4];
            // Get Y coordinate
            const y = item.transform[5];
            // Find existing row key within tolerance
            let foundKey: number | null = null;
            // Look for matching row Y
            for (const rowYStr of Object.keys(rows)) {
              // Parse float key
              const rowY = parseFloat(rowYStr);
              // Compare distance
              if (Math.abs(rowY - y) <= tolerance) {
                // Save key
                foundKey = rowY;
                // Exit search loop
                break;
              }
            }
            // Resolve key Y
            const key = foundKey !== null ? foundKey : y;
            // Initialize row if empty
            if (!rows[key]) {
              // Set empty array
              rows[key] = [];
            }
            // Push item properties
            rows[key].push({ text, x, y });
          }
        }
        // Get sorted list of Y values descending
        const sortedY = Object.keys(rows).map(parseFloat).sort((a, b) => b - a);
        // Loop through sorted rows
        for (const y of sortedY) {
          // Sort row items left to right
          const items = rows[y].sort((a, b) => a.x - b.x);
          // Combine items into single line string
          const rowLine = items.map((item) => item.text).join(' ');
          // Add to full text output
          fullText += rowLine + '\n';
        }
      }
      // Determine if a non-SEK currency is used in the statement
      let conversionRate = 1.0;
      // Convert text to lowercase to search for currencies
      const lowerFullText = fullText.toLowerCase();
      // Check for Euro symbols or keywords
      if (lowerFullText.includes('eur') || lowerFullText.includes('€')) {
        // Set conversion rate from EUR to SEK
        conversionRate = 11.5;
      // Check for US Dollar symbols or keywords
      } else if (lowerFullText.includes('usd') || lowerFullText.includes('$')) {
        // Set conversion rate from USD to SEK
        conversionRate = 10.5;
      }
      // Split full text string block by line breaks
      const lines = fullText.split('\n');
      // Create empty collection of parsed entries
      const parsedTxs: ParsedTx[] = [];
      // Define list of words indicating non-transaction rows
      const skipKeywords = ['saldo', 'skapad', 'privatkonto', 'kontohavare', 'sida', 'referens', 'belopp', 'bokfört', 'transaktioner', 'ingående'];
      // Loop over every reconstructed line row
      for (const line of lines) {
        // Convert row text to lowercase
        const lowerLine = line.toLowerCase();
        // Skip current line if it matches any non-transaction keywords
        if (skipKeywords.some((kw) => lowerLine.includes(kw))) continue;
        // Define regex pattern to parse calendar dates
        const dateRegex = /(\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b)/;
        // Attempt matching pattern on line text
        const dateMatch = line.match(dateRegex);
        // Skip current line if no date matches pattern
        if (!dateMatch) continue;
        // Define regex pattern to parse decimal numeric values
        const amountRegex = /(-|\+)?\s*\b\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}\b/g;
        // Declare array collection to store matched numeric records
        const amountMatches: RegExpExecArray[] = [];
        // Declare holding variable for matching execution outcomes
        let match;
        // Loop continuously to extract regex executions match
        while ((match = amountRegex.exec(line)) !== null) {
          // Add matched match collection to array
          amountMatches.push(match);
        }
        // Skip current line if no amount matches found
        if (amountMatches.length === 0) continue;
        // Declare raw amount text holder
        let rawAmountStr = '';
        // If there are multiple amount matches (standard with running balance)
        if (amountMatches.length >= 2) {
          // Select second to last match as transaction amount
          rawAmountStr = amountMatches[amountMatches.length - 2][0];
        } else {
          // Select single match as transaction amount
          rawAmountStr = amountMatches[0][0];
        }
        // Clean blank space sequences from numbers
        let cleanAmountStr = rawAmountStr.replace(/\s/g, '');
        // Check if both punctuation symbols are inside string
        if (cleanAmountStr.indexOf(',') > -1 && cleanAmountStr.indexOf('.') > -1) {
          // If dot separator occurs first, clean dot out
          if (cleanAmountStr.indexOf(',') > cleanAmountStr.indexOf('.')) {
            // Remove dots and convert comma to dot decimals
            cleanAmountStr = cleanAmountStr.replace(/\./g, '').replace(/,/g, '.');
          } else {
            // Strip out comma separator completely
            cleanAmountStr = cleanAmountStr.replace(/,/g, '');
          }
        } else if (cleanAmountStr.indexOf(',') > -1) {
          // Swap standard comma decimal separator with dot
          cleanAmountStr = cleanAmountStr.replace(/,/g, '.');
        }
        // Parse float value from cleaned text representation
        const amountVal = parseFloat(cleanAmountStr);
        // Skip row if parsing resulted in non-numeric values
        if (isNaN(amountVal)) continue;
        // Save matched date string text
        const dateStr = dateMatch[0];
        // Parse date segments using helper
        const { year: parsedYear, month: parsedMonth, day: parsedDay } = parseDateParts(dateStr);
        // Clean description by removing date, amounts, references, and extra spaces
        let cleanDesc = line;
        // Remove date sequences from description
        cleanDesc = cleanDesc.replace(new RegExp(dateRegex, 'g'), '');
        // Loop over amount matches to remove them
        for (const matchObj of amountMatches) {
          // Replace amount text with blank
          cleanDesc = cleanDesc.replace(matchObj[0], '');
        }
        // Remove 10 to 12 digit account/reference numbers
        cleanDesc = cleanDesc.replace(/\b\d{10,12}\b/g, '');
        // Remove separate single digits
        cleanDesc = cleanDesc.replace(/\b\d+\b/g, '');
        // Clean extra repeating spaces
        cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim();
        // Split description by spaces to check for duplicate halves
        const wordsList = cleanDesc.split(' ');
        // Verify even count of words greater than one
        if (wordsList.length > 1 && wordsList.length % 2 === 0) {
          // Get middle index point
          const halfIdx = wordsList.length / 2;
          // Join first half of words
          const firstHalfWords = wordsList.slice(0, halfIdx).join(' ');
          // Join second half of words
          const secondHalfWords = wordsList.slice(halfIdx).join(' ');
          // Compare both halves of string
          if (firstHalfWords === secondHalfWords) {
            // Keep only first half if identical
            cleanDesc = firstHalfWords;
          }
        }
        // Fallback name if description resolved empty
        if (!cleanDesc) cleanDesc = 'Bank Transaction';
        // Check if there is a saved mapping for this description
        const rawSavedCategoryId3 = pdfConfig?.mappings[cleanDesc];
        // Validate saved category ID still exists in the current categories list
        const savedCategoryId = rawSavedCategoryId3 && categories.some((c) => c.id === rawSavedCategoryId3) ? rawSavedCategoryId3 : undefined;
        // Check if this description is flagged to ignore
        const isIgnored = pdfConfig?.ignored.includes(cleanDesc);
        // Check transaction type based on original amountVal sign
        const txType = amountVal < 0 ? 'sent' : 'received';
        // Add new transaction row data structure object
        parsedTxs.push({
          // Generate unique ID
          id: Math.random().toString(36).substr(2, 9),
          // Set raw date
          date: dateStr,
          // Constrain paymentDay between 1 and 31
          paymentDay: Math.min(Math.max(parsedDay, 1), 31),
          // Set parsed month
          month: parsedMonth,
          // Set parsed year
          year: parsedYear,
          // Assign description
          description: cleanDesc,
          // Save absolute amount values converted to SEK
          amount: Math.abs(amountVal) * conversionRate,
          // Check true if transaction was debit negative and not ignored
          selected: isIgnored ? false : amountVal < 0,
          // Resolve matching category link using saved mappings or keyword matching
          categoryId: savedCategoryId || findMatchingCategory(cleanDesc),
          // Assign transaction type
          type: txType
        });
      }
      // Update transaction list state structure
      setTransactions(parsedTxs);
      // Set status message text helper
      setStatusMessage(`Found ${parsedTxs.length} transaction entries.`);
      // If transactions were found, move to Step 2
      if (parsedTxs.length > 0) {
        setStep(2);
      }
    } catch (err) {
      // Log errors in console
      console.error(err);
      // Update message with error details
      setStatusMessage('Error parsing PDF. Please verify file is a statement.');
    } finally {
      // Terminate loading indicators
      setLoading(false);
    }
  };

  // Handle standard file picker changes event
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Verify target files count
    if (e.target.files && e.target.files[0]) {
      // Process uploaded file
      processFile(e.target.files[0]);
    }
  };

  // Handle drag hover event state
  const handleDrag = (e: React.DragEvent) => {
    // Intercept standard browser actions
    e.preventDefault();
    // Intercept event propagation
    e.stopPropagation();
    // Check drag start / enter trigger types
    if (e.type === 'dragenter' || e.type === 'dragover') {
      // Activate drag overlay state
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      // Deactivate drag hover states
      setDragActive(false);
    }
  };

  // Handle file drop event processing
  const handleDrop = (e: React.DragEvent) => {
    // Prevent default actions
    e.preventDefault();
    // Intercept propagation
    e.stopPropagation();
    // Disable hover active state
    setDragActive(false);
    // Verify data transfer items exist
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Process dropped file
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle selection status of transaction row
  const toggleSelect = (id: string) => {
    // Update transactions collection selection state
    setTransactions(
      // Map over transactions list
      transactions.map((tx) =>
        // Toggle selected match flag
        tx.id === id ? { ...tx, selected: !tx.selected } : tx
      )
    );
  };

  // Modify target Category ID mapping link on row
  const handleCategoryChange = (id: string, catId: string) => {
    // Update matching transaction categories key
    setTransactions(
      // Map elements list
      transactions.map((tx) =>
        // Match key index id
        tx.id === id ? { ...tx, categoryId: catId } : tx
      )
    );
  };

  // Modify text description string on row
  const handleDescriptionChange = (id: string, name: string) => {
    // Update transactions fields
    setTransactions(
      // Map elements list
      transactions.map((tx) =>
        // Match key index id
        tx.id === id ? { ...tx, description: name } : tx
      )
    );
  };

  // Perform actual import operation saving config and inserting selected expenses
  const executeImport = () => {
    // Filter active items checked selected and matching current month/year
    const toImport = transactions.filter((tx) => tx.selected && tx.categoryId && tx.month === currentMonth && tx.year === currentYear);
    // Filter out transactions whose category ID no longer exists in the categories list
    const validToImport = toImport.filter((tx) => categories.some((c) => c.id === tx.categoryId));
    // Map valid transactions into formatted batch expense items
    const expensesPayload = validToImport.map((tx) => ({
      // Target category ID
      categoryId: tx.categoryId,
      // Target expense payload
      expense: {
        // Description label name
        name: tx.description,
        // Parsed amount cost
        amount: tx.amount,
        // Calendar day parsed
        paymentDay: tx.paymentDay,
        // Mark recurring default off
        isRecurring: false,
      }
    }));
    // Check if there are any items to import
    if (expensesPayload.length > 0) {
      // Trigger batch expenses addition helper function
      addExpenses(expensesPayload);
    }
    // Update PDF import preferences based on current selections
    const newMappings = { ...(pdfConfig?.mappings || {}) };
    // Create new copy of ignored lists
    let newIgnored = [...(pdfConfig?.ignored || [])];
    // Loop through parsed list
    for (const tx of transactions) {
      // If transaction was selected and had a valid category
      if (tx.selected && tx.categoryId) {
        // Add or update mapping
        newMappings[tx.description] = tx.categoryId;
        // Filter out from ignored list
        newIgnored = newIgnored.filter((name) => name !== tx.description);
      } else {
        // Remove from mappings list if it existed
        delete newMappings[tx.description];
        // Push description to ignored list if not present
        if (!newIgnored.includes(tx.description)) {
          // Add to ignored list
          newIgnored.push(tx.description);
        }
      }
    }
    // Persist new config to database
    updatePDFConfig({ mappings: newMappings, ignored: newIgnored });
    // Dismiss confirmation modal
    setShowConfirmModal(false);
    // Populate unique merchant names from selected transactions only for mapping in Step 3
    const uniqueNames = Array.from(new Set(transactions.filter((tx) => tx.selected).map((tx) => tx.description)));
    // Update the retrieved merchant names list state
    setRetrievedNames(uniqueNames);
    // Transition to settings mapping wizard step 3
    setStep(3);
  };

  // Import selected transaction entries into context database
  const handleImport = () => {
    // Extract all selected transactions for current month/year
    const selectedTxs = transactions.filter((tx) => tx.selected && tx.month === currentMonth && tx.year === currentYear);
    // Block import if no transactions match current month/year
    if (selectedTxs.length === 0) {
      // Show error message
      setStatusMessage("No transactions for the current month to import.");
      // Stop execution
      return;
    }
    // Identify selected transactions that have a valid category
    const validToImport = selectedTxs.filter((tx) => tx.categoryId);
    // Block import if any selected transaction is missing a category
    if (validToImport.length !== selectedTxs.length) {
      // Show error message
      setStatusMessage("Please map categories for all selected transactions before importing.");
      // Stop execution
      return;
    }
    // Show confirmation dialog overlay
    setShowConfirmModal(true);
  };

  // Helper to extract unique merchant names from a PDF statement file buffer
  const parsePdfForNames = async (arrayBuffer: ArrayBuffer) => {
    // Set settings loading status to true
    setSettingsLoading(true);
    // Try block to handle document reading safely
    try {
      // Create document loader with buffer data
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      // Wait for promise resolution of document metadata
      const pdf = await loadingTask.promise;
      // Initialize text content accumulator string
      let fullText = '';
      // Loop over every page index
      for (let i = 1; i <= pdf.numPages; i++) {
        // Load target page instance object
        const page = await pdf.getPage(i);
        // Get raw text items representation
        const textContent = await page.getTextContent();
        // Row grouping hashmap
        const rows: { [key: number]: any[] } = {};
        // Set row distance grouping tolerance
        const tolerance = 4;
        // Loop over text content items collection
        for (const item of textContent.items) {
          // Verify item object structure contains string
          if ('str' in item) {
            // Trim extra spaces
            const text = item.str.trim();
            // Check if text is empty
            if (!text) {
              // Skip empty text
              continue;
            }
            // Get X coordinate
            const x = item.transform[4];
            // Get Y coordinate
            const y = item.transform[5];
            // Find existing row key within tolerance
            let foundKey: number | null = null;
            // Loop through existing row keys
            for (const rowYStr of Object.keys(rows)) {
              // Parse Y index coordinate float
              const rowY = parseFloat(rowYStr);
              // Check distance match
              if (Math.abs(rowY - y) <= tolerance) {
                // Assign matching coordinate key
                foundKey = rowY;
                // Terminate search loop
                break;
              }
            }
            // Use matched key coordinate
            const key = foundKey !== null ? foundKey : y;
            // Check if row array is defined
            if (!rows[key]) {
              // Set blank array
              rows[key] = [];
            }
            // Push text element attributes
            rows[key].push({ text, x, y });
          }
        }
        // Sort Y coordinates descending
        const sortedY = Object.keys(rows).map(parseFloat).sort((a, b) => b - a);
        // Loop over sorted Y rows keys
        for (const y of sortedY) {
          // Sort items from left to right coordinate
          const items = rows[y].sort((a, b) => a.x - b.x);
          // Join elements text with spaces
          const rowLine = items.map((item) => item.text).join(' ');
          // Append line block
          fullText += rowLine + '\n';
        }
      }
      // Split full document text lines
      const lines = fullText.split('\n');
      // Set to hold unique description names
      const uniqueNames = new Set<string>();
      // Non-transaction header skip keywords array list
      const skipKeywords = ['saldo', 'skapad', 'privatkonto', 'kontohavare', 'sida', 'referens', 'belopp', 'bokfört', 'transaktioner', 'ingående'];
      // Loop over extracted text lines
      for (const line of lines) {
        // Convert to lowercase for matching
        const lowerLine = line.toLowerCase();
        // Check if skip keyword matches
        if (skipKeywords.some((kw) => lowerLine.includes(kw))) {
          // Skip line
          continue;
        }
        // Match date patterns
        const dateRegex = /(\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b)/;
        // Verify line contains date
        const dateMatch = line.match(dateRegex);
        // Check if date exists
        if (!dateMatch) {
          // Skip if date mismatch found
          continue;
        }
        // Match amount patterns
        const amountRegex = /(-|\+)?\s*\b\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}\b/g;
        // Exec matcher loop
        const amountMatches: RegExpExecArray[] = [];
        // Match capture reference
        let match;
        // Loop match instances
        while ((match = amountRegex.exec(line)) !== null) {
          // Save match result
          amountMatches.push(match);
        }
        // Check if amount exists
        if (amountMatches.length === 0) {
          // Skip line if no amounts found
          continue;
        }
        // Extract clean description text
        let cleanDesc = line;
        // Remove date sequences
        cleanDesc = cleanDesc.replace(new RegExp(dateRegex, 'g'), '');
        // Loop amount strings
        for (const matchObj of amountMatches) {
          // Strip out amount numbers from line text
          cleanDesc = cleanDesc.replace(matchObj[0], '');
        }
        // Remove account numbers patterns
        cleanDesc = cleanDesc.replace(/\b\d{10,12}\b/g, '');
        // Remove standalone digit sequences
        cleanDesc = cleanDesc.replace(/\b\d+\b/g, '');
        // Replace spaces sequences
        cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim();
        // Deduplicate split text halves
        const wordsList = cleanDesc.split(' ');
        // Even split match check
        if (wordsList.length > 1 && wordsList.length % 2 === 0) {
          // Get middle index point
          const halfIdx = wordsList.length / 2;
          // Join first half of words
          const firstHalfWords = wordsList.slice(0, halfIdx).join(' ');
          // Join second half of words
          const secondHalfWords = wordsList.slice(halfIdx).join(' ');
          // Check halves identical match
          if (firstHalfWords === secondHalfWords) {
            // Deduplicate name
            cleanDesc = firstHalfWords;
          }
        }
        // Check if name is empty
        if (!cleanDesc) {
          // Fallback title label
          cleanDesc = 'Bank Transaction';
        }
        // Add to unique names set
        uniqueNames.add(cleanDesc);
      }
      // Populate unique name list values
      setRetrievedNames(Array.from(uniqueNames));
    } catch (err) {
      // Print error logs
      console.error(err);
    } finally {
      // Set settings loading status false
      setSettingsLoading(false);
    }
  };

  // Handle settings file select event trigger
  const handleSettingsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Verify target files content count
    if (e.target.files && e.target.files[0]) {
      // Process uploaded settings file
      processSettingsFile(e.target.files[0]);
    }
  };

  // Drag over drag settings event handlers
  const handleSettingsDrag = (e: React.DragEvent) => {
    // Prevent default
    e.preventDefault();
    // Stop propagation
    e.stopPropagation();
    // Match event active status
    if (e.type === 'dragenter' || e.type === 'dragover') {
      // Set settings drag active true
      setSettingsDragActive(true);
    } else if (e.type === 'dragleave') {
      // Set settings drag active false
      setSettingsDragActive(false);
    }
  };

  // Drop statement files inside settings event handlers
  const handleSettingsDrop = (e: React.DragEvent) => {
    // Prevent standard default actions
    e.preventDefault();
    // Stop event propagation
    e.stopPropagation();
    // Disable active drag overlay
    setSettingsDragActive(false);
    // Verify file data drops exist
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Process dropped settings file
      processSettingsFile(e.dataTransfer.files[0]);
    }
  };

  // Handle adding manual name-to-category mapping rule in settings tab
  const handleAddManualMapping = () => {
    // Verify parameters name and target category are present
    if (newMapName && newMapCat) {
      // Clone existing configuration mappings dictionary
      const mappings = { ...(pdfConfig?.mappings || {}) };
      // Assign category ID value to key
      mappings[newMapName.trim()] = newMapCat;
      // Trigger update configurations call
      updatePDFConfig({ mappings, ignored: pdfConfig?.ignored || [] });
      // Reset text fields value state
      setNewMapName('');
      // Reset select category value state
      setNewMapCat('');
    }
  };

  // Handle modifying Category ID mapping directly inside settings list
  const handleUpdateManualMapping = (name: string, catId: string) => {
    // Clone mappings configs
    const mappings = { ...(pdfConfig?.mappings || {}) };
    // Update target category mapping
    mappings[name] = catId;
    // Persist changes
    updatePDFConfig({ mappings, ignored: pdfConfig?.ignored || [] });
  };

  // Handle deleting manual category mappings entry
  const handleDeleteManualMapping = (name: string) => {
    // Clone existing mapping dictionary configurations
    const mappings = { ...(pdfConfig?.mappings || {}) };
    // Remove target key from mappings
    delete mappings[name];
    // Trigger update configs call
    updatePDFConfig({ mappings, ignored: pdfConfig?.ignored || [] });
  };

  // Handle manual addition to ignore list records
  const handleAddManualIgnore = () => {
    // Verify ignore rules target name exists
    if (newIgnoreName) {
      // Clone current ignored names collection
      const ignored = [...(pdfConfig?.ignored || [])];
      // Check if ignore name is not present in collection
      if (!ignored.includes(newIgnoreName.trim())) {
        // Append new ignore name string
        ignored.push(newIgnoreName.trim());
        // Trigger update configs call
        updatePDFConfig({ mappings: pdfConfig?.mappings || {}, ignored });
      }
      // Reset ignore input text field value state
      setNewIgnoreName('');
    }
  };

  // Handle deleting entry from manual ignore list
  const handleDeleteManualIgnore = (name: string) => {
    // Clone and filter out target ignore name string
    const ignored = (pdfConfig?.ignored || []).filter((n) => n !== name);
    // Trigger update configs call
    updatePDFConfig({ mappings: pdfConfig?.mappings || {}, ignored });
  };

  // Filter transactions list dynamically matching search, selections, and active month/year
  const filteredTransactions = transactions.filter((tx) => {
    // Verify transaction belongs to currently viewed month and year
    const matchesMonthYear = tx.month === currentMonth && tx.year === currentYear;
    // Check search query text match
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    // Track selection status verification
    let matchesStatus = true;
    // Filter selected status
    if (filterStatus === 'selected') {
      // Must be selected
      matchesStatus = tx.selected;
    }
    // Filter unselected status
    else if (filterStatus === 'unselected') {
      // Must not be selected
      matchesStatus = !tx.selected;
    }
    // Filter unmapped status
    else if (filterStatus === 'unmapped') {
      // Must lack category ID
      matchesStatus = !tx.categoryId;
    }
    // Filter received transactions status
    else if (filterStatus === 'received') {
      // Must be received transaction
      matchesStatus = tx.type === 'received';
    }
    // Filter sent transactions status
    else if (filterStatus === 'sent') {
      // Must be sent transaction
      matchesStatus = tx.type === 'sent';
    }
    // Return combined evaluation matches
    return matchesMonthYear && matchesSearch && matchesStatus;
  });

  // Count how many loaded transactions belong to other months
  const otherMonthsCount = transactions.filter((tx) => tx.month !== currentMonth || tx.year !== currentYear).length;

  // Check if status message represents an error
  const isErrorStatus = statusMessage.toLowerCase().includes('error') || 
                        // Match unsupported file format keyword
                        statusMessage.toLowerCase().includes('unsupported') || 
                        // Match no transactions keyword
                        statusMessage.toLowerCase().includes('no transactions') || 
                        // Match category mapping warning keyword
                        statusMessage.toLowerCase().includes('please map');
  // Check if status message represents a success transaction count load
  const isSuccessStatus = statusMessage.toLowerCase().includes('found');
  // Determine dynamic text color based on message types
  const statusColor = isErrorStatus 
    // Return red for errors
    ? 'var(--firebase-red)' 
    // Check success status
    : (isSuccessStatus 
      // Return green for success
      ? '#4caf50' 
      // Return secondary text color for info/progress messages
      : 'var(--text-secondary)');

  // Helper method to safely render status messages without inline JSX comment issues
  const renderStatus = () => {
    // Check if status message is empty
    if (!statusMessage) {
      // Return null if empty
      return null;
    // Close check
    }
    // Return colored paragraph element
    return (
      // Paragraph container with dynamic color
      <p style={{ color: statusColor, fontSize: '0.85rem', margin: 0 }}>
        {/* Render text */}
        {statusMessage}
      {/* End paragraph */}
      </p>
    // Close return statement
    );
  // Close helper method
  };

  // Render modal layout template
  return (
    // Backdrop modal overlay wrapper
    <div className={styles.overlay} onClick={onClose}>
      {/* Modal structure container panel */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header toolbar banner */}
        <div className={styles.header}>
          {/* Header Title */}
          <h3 className={styles.title}>Import Statement</h3>
          {/* Close button cross */}
          <button className={styles.closeBtn} onClick={onClose}>
            {/* SVG close shape icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Line cross x */}
              <line x1="18" y1="6" x2="6" y2="18"></line>
              {/* Line cross reverse */}
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Navigation wizard steps indicator */}
        <div className={styles.stepsContainer}>
          {/* Wizard step 1 container */}
          <div className={`${styles.stepItem} ${step === 1 ? styles.stepActive : step > 1 ? styles.stepCompleted : ''}`}>
            {/* Numeric badge for step 1 */}
            <span className={`${styles.stepBadge} ${step === 1 ? styles.stepBadgeActive : step > 1 ? styles.stepBadgeCompleted : ''}`}>
              {/* If step 1 completed show checkmark otherwise number */}
              {step > 1 ? '✓' : '1'}
            </span>
            {/* Label for step 1 */}
            <span>Load File</span>
          </div>
          {/* Wizard step 2 container */}
          <div className={`${styles.stepItem} ${step === 2 ? styles.stepActive : step > 2 ? styles.stepCompleted : ''}`}>
            {/* Numeric badge for step 2 */}
            <span className={`${styles.stepBadge} ${step === 2 ? styles.stepBadgeActive : step > 2 ? styles.stepBadgeCompleted : ''}`}>
              {/* If step 2 completed show checkmark otherwise number */}
              {step > 2 ? '✓' : '2'}
            </span>
            {/* Label for step 2 */}
            <span>Select</span>
          </div>
          {/* Wizard step 3 container */}
          <div className={`${styles.stepItem} ${step === 3 ? styles.stepActive : ''}`}>
            {/* Numeric badge for step 3 */}
            <span className={`${styles.stepBadge} ${step === 3 ? styles.stepBadgeActive : ''}`}>
              {/* Display step number */}
              3
            </span>
            {/* Label for step 3 */}
            <span>Configure</span>
          </div>
        </div>

        {/* Modal scrollable main body */}
        <div className={styles.body}>
          {/* Check if currently in step 1 */}
          {step === 1 ? (
            // Check loading status
            loading ? (
              // Spinner block wrapper
              <div className={styles.statusContainer}>
                {/* Spinning border indicator */}
                <div className={styles.spinner} />
                {/* Status message details */}
                <p className={styles.pickerText}>{statusMessage}</p>
              </div>
            ) : (
              // Upload picker active target drag zones
              <div
                // CSS class conditional check drag hover
                className={`${styles.pickerZone} ${dragActive ? styles.pickerZoneActive : ''}`}
                // Drag enter hook
                onDragEnter={handleDrag}
                // Drag over browser intercept
                onDragOver={handleDrag}
                // Drag leave hook
                onDragLeave={handleDrag}
                // File drop parse trigger
                onDrop={handleDrop}
                // Touch click file picker trigger
                onClick={() => fileInputRef.current?.click()}
              >
                {/* File upload hidden element */}
                <input
                  // Ref selector link
                  ref={fileInputRef}
                  // File input type
                  type="file"
                  // Hide input element
                  className={styles.hiddenInput}
                  // Filter PDF, CSV, Excel types only
                  accept="application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  // Callback value picker change
                  onChange={handleFileChange}
                />
                {/* Large touch picker icon SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {/* SVG path shape */}
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  {/* SVG details fold */}
                  <polyline points="14 2 14 8 20 8"></polyline>
                  {/* SVG arrow line */}
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  {/* SVG pointer cap */}
                  <polyline points="9 15 12 12 15 15"></polyline>
                </svg>
                {/* Picker descriptive instructions */}
                <p className={styles.pickerText}>
                  {/* Descriptive mobile touch message */}
                  Tap to choose a statement PDF, CSV, or Excel file
                </p>
                {/* Render dynamic status message element */}
                {renderStatus()}
              </div>
            )
          ) : step === 2 ? (
            // Results list wrapper container
            <div className={styles.transactionList}>
              {/* Filter controls row */}
              <div className={styles.filterBar}>
                {/* Text search filter input field */}
                <input
                  // Bind search text query state
                  value={searchQuery}
                  // Input changes callback handler
                  onChange={(e) => setSearchQuery(e.target.value)}
                  // Search query text input placeholder
                  placeholder="Search description..."
                  // Custom filter input class styling
                  className={styles.filterInput}
                />
                {/* Container for select dropdown inputs to align them in a row */}
                <div className={styles.filterSelectGroup}>
                  {/* Filter dropdown selection for transaction selection state */}
                  <select
                    // Bind status filter key value
                    value={filterStatus}
                    // Selector changed callback handler
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    // Select element class styling
                    className={styles.filterSelect}
                    // Full width styling layout override
                    style={{ width: '100%' }}
                  >
                    {/* Option for displaying all items */}
                    <option value="all">All Status</option>
                    {/* Option for selected checkboxes */}
                    <option value="selected">Selected Only</option>
                    {/* Option for unchecked checkboxes */}
                    <option value="unselected">Unselected Only</option>
                    {/* Option for transactions lacking categories */}
                    <option value="unmapped">Unmapped Only</option>
                    {/* Option for received transactions */}
                    <option value="received">Received Only</option>
                    {/* Option for sent transactions */}
                    <option value="sent">Sent Only</option>
                  </select>
                </div>
              </div>

              {/* Check if transactions from other months were found */}
              {otherMonthsCount > 0 && (
                // Warning container banner
                <div 
                  // CSS styles matching theme
                  style={{
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    marginBottom: '0.75rem',
                    color: '#ffa726',
                    fontSize: '0.8rem',
                    lineHeight: '1.4'
                  }}
                >
                  {/* Warning message text */}
                  ⚠️ {otherMonthsCount} transactions from other months were skipped. Change the active month on the dashboard to import them.
                </div>
              )}

              {/* Selection summary statistics row toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0 0.75rem 0' }}>
                {/* Filtered count matching description search query */}
                <span className={styles.pickerText}>
                  {/* Print summary text */}
                  Showing {filteredTransactions.length} of {transactions.length} rows
                </span>
                {/* Toggle Select All checkboxes button trigger */}
                <button
                  // Click handler callback to toggle checkbox select all state
                  onClick={() => {
                    // Check if any filtered transaction is selected
                    const allSelected = filteredTransactions.every((tx) => tx.selected);
                    // Map transactions to toggle checked state on filtered matches
                    setTransactions(
                      transactions.map((tx) =>
                        filteredTransactions.some((ft) => ft.id === tx.id)
                          ? { ...tx, selected: !allSelected }
                          : tx
                      )
                    );
                  }}
                  // Secondary styling button class
                  className={styles.btnSecondary}
                  // Sizing adjustments inline styles overrides
                  style={{ minHeight: '32px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                >
                  {/* Conditional labels */}
                  {filteredTransactions.every((tx) => tx.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Scrollable list containing filtered transaction entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Iterate transactions row cards */}
                {filteredTransactions.map((tx) => {
                  // Resolve category color
                  const catColor = categories.find((c) => c.id === tx.categoryId)?.color;
                  // Define category badge style object
                  const badgeStyle = {
                    // Set category background color with opacity
                    backgroundColor: catColor ? `${catColor}20` : 'rgba(255, 255, 255, 0.08)',
                    // Set text color matching category color
                    color: catColor || '#ccc',
                    // Set border color matching category color
                    borderColor: catColor ? `${catColor}40` : 'transparent'
                  };
                  // Return transaction card element
                  return (
                    // Transaction item card panel
                    <div key={tx.id} className={styles.transactionCard}>
                      {/* Checkbox trigger target */}
                      <div className={styles.checkboxContainer} onClick={() => toggleSelect(tx.id)}>
                        {/* Native checkbox input */}
                        <input
                          // Checked status variable
                          type="checkbox"
                          // Bind state value
                          checked={tx.selected}
                          // Disable native change wrapper
                          onChange={() => {}}
                          // Apply large touch size class
                          className={styles.checkbox}
                        />
                      </div>
                      {/* Text card content block display as horizontal row container */}
                      <div className={styles.cardContent} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                        {/* Center block to stack description, date, and category selector vertically */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                          {/* Display read-only transaction description text */}
                          <span className={styles.pickerText} style={{ fontWeight: 500, color: '#fff', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {/* Print description */}
                            {tx.description}
                          </span>
                          {/* Date text label printed underneath the merchant description */}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {/* Print raw date */}
                            {tx.date}
                          </span>
                          {/* Category select dropdown */}
                          <select
                            // Selected bound value
                            value={tx.categoryId}
                            // Category changed update handler
                            onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                            // Dropdown styling
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.35rem',
                              marginTop: '0.25rem',
                              width: '100%',
                              maxWidth: '180px',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {/* Option label placeholder */}
                            <option value="" style={{ backgroundColor: '#1e1e1e' }}>-- Map Category --</option>
                            {/* Loop categories option items */}
                            {categories.map((cat) => (
                              // Option element
                              <option key={cat.id} value={cat.id} style={{ backgroundColor: '#1e1e1e' }}>
                                {/* Category name */}
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Right aligned transaction amount */}
                        <span className={styles.amount} style={{ color: tx.selected ? 'var(--firebase-yellow)' : 'var(--text-secondary)', flexShrink: 0 }}>
                          {/* Formatting currency values */}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Render settings manually configurations wizard step 3
            // Outer wrapper division for configuration options
            <div>
              {/* Reset configuration action panel row wrapper */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                {/* Reset button executing configurations erase */}
                <button
                  // Click trigger opens configurations reset confirm modal
                  onClick={() => setShowConfirmErase(true)}
                  // Styling overrides matching secondary buttons with red borders
                  style={{
                    // Empty background fill
                    background: 'transparent',
                    // Red translucent border line
                    border: '1px solid rgba(244, 67, 54, 0.4)',
                    // Red text color
                    color: '#ff5252',
                    // Spacing paddings
                    padding: '0.4rem 0.8rem',
                    // Rounded borders layout
                    borderRadius: '6px',
                    // Touch pointer interaction
                    cursor: 'pointer',
                    // Sized typography font
                    fontSize: '0.8rem',
                    // Transition animation settings
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Erase button text label */}
                  Erase Import Config
                </button>
              </div>
              {/* Configuration loader section block wrapper */}
              <div className={styles.settingsSection}>
                {/* Retrieving merchants label heading title */}
                <h4 className={styles.sectionTitle}>Configure Statement Merchant Mappings</h4>
                {/* Scrollable listing box */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {/* Loop retrieved unique merchant labels */}
                  {retrievedNames.map((name) => {
                    // Check if current name exists in ignore array
                    const isIgnored = pdfConfig?.ignored.includes(name);
                    // Resolve mapped category ID if present
                    const currentCatId = pdfConfig?.mappings[name] || '';
                    // Determine if mapped category ID still exists in the categories list
                    const isMappedCatDeleted = currentCatId !== '' && !categories.some((c) => c.id === currentCatId);
                    // Return individual merchant row layout
                    return (
                      // Card container row
                      <div key={name} className={styles.settingsRow} style={{ padding: '0.5rem 0.75rem' }}>
                        {/* Merchant name label text */}
                        <span className={styles.settingsLabel} style={{ fontSize: '0.85rem' }}>{name}</span>
                        {/* Category map dropdown selector */}
                        <select
                          // Selected bound value
                          value={isMappedCatDeleted ? '__DELETED__' : currentCatId}
                          // Selection changed update callback
                          onChange={(e) => {
                            // Extract target value string
                            const val = e.target.value;
                            // Skip deleted sentinel value selections
                            if (val === '__DELETED__') return;
                            // Check if option is to create new category
                            if (val === 'CREATE_NEW') {
                              // Trigger create category modal for this merchant mapping
                              setActiveCreateCategoryTrigger({ type: 'merchant', key: name });
                              // Stop processing mapping update
                              return;
                            }
                            // Clone mappings configuration structure
                            const mappings = { ...(pdfConfig?.mappings || {}) };
                            // Filter name out from ignored lists
                            const ignored = (pdfConfig?.ignored || []).filter((n) => n !== name);
                            // If val contains target option
                            if (val) {
                              // Set category link mapping
                              mappings[name] = val;
                            } else {
                              // Clear mapping element key
                              delete mappings[name];
                            }
                            // Dispatch changes update configuration context
                            updatePDFConfig({ mappings, ignored });
                          }}
                          // Standard categories select input styling
                          className={styles.categorySelect}
                          // Sizing inline adjustments overrides
                          style={{ width: 'auto', flex: 1, minWidth: '120px', minHeight: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          {/* Option label placeholder */}
                          <option value="">-- Map Category --</option>
                          {/* Show deleted category sentinel option when mapped cat no longer exists */}
                          {isMappedCatDeleted && (
                            // Disabled placeholder option indicating the previously mapped category was deleted
                            <option value="__DELETED__" disabled style={{ color: '#ef4444' }}>⚠ (Deleted Category)</option>
                          )}
                          {/* Option to create a new category inline */}
                          <option value="CREATE_NEW">+ Create New Category</option>
                          {/* Loop database categories */}
                          {categories.map((cat) => (
                            // Category target option details
                            <option key={cat.id} value={cat.id}>
                              {/* Print category name */}
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        {/* Toggle ignore settings status button action */}
                        <button
                          // Click action toggle
                          onClick={() => {
                            // Clone mappings structure
                            const mappings = { ...(pdfConfig?.mappings || {}) };
                            // Strip category link key
                            delete mappings[name];
                            // Clone ignored elements names list
                            let ignored = [...(pdfConfig?.ignored || [])];
                            // Toggle active state check
                            if (isIgnored) {
                              // Filter name out
                              ignored = ignored.filter((n) => n !== name);
                            } else {
                              // Append ignore name
                              ignored.push(name);
                            }
                            // Update configuration context
                            updatePDFConfig({ mappings, ignored });
                          }}
                          // Active/inactive button styling assignments
                          className={isIgnored ? styles.btnPrimary : styles.btnSecondary}
                          // Custom styling for toggle button state
                          style={{
                            // Dimension height bounds
                            minHeight: '32px',
                            // Inner padding spacing
                            padding: '0.25rem 0.75rem',
                            // Text size font scale
                            fontSize: '0.8rem',
                            // Red coloring for ignores
                            backgroundColor: isIgnored ? 'var(--firebase-red)' : 'transparent',
                            // Contrast text color
                            color: isIgnored ? '#fff' : '#ccc',
                            // Custom borders alignment highlights
                            borderColor: isIgnored ? 'var(--firebase-red)' : 'rgba(255, 255, 255, 0.15)'
                          }}
                        >
                          {/* Render dynamic button text state */}
                          {isIgnored ? 'Ignored' : 'Ignore'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Settings Category Mappings Area Block */}
              <div className={styles.settingsSection}>
                {/* Clickable section title header to collapse/expand content */}
                <h4 
                  // CSS class styling
                  className={styles.sectionTitle}
                  // Click handler to toggle collapsed state
                  onClick={() => setMappingsCollapsed(!mappingsCollapsed)}
                  // Pointer cursor inline styling to indicate clickability
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                >
                  {/* Title text label */}
                  <span>All Saved Merchant-Category Mappings</span>
                  {/* Expand/collapse status indicator arrow */}
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{mappingsCollapsed ? '▶' : '▼'}</span>
                </h4>
                {/* Render mappings form and list if the section is expanded */}
                {!mappingsCollapsed && (
                  // React Fragment wrapper
                  <>
                {/* Form to add custom manual mapping entry rule */}
                <div className={styles.addForm}>
                  {/* Text input for transaction name key */}
                  <input 
                    // Input type
                    type="text"
                    // Bind map name value
                    value={newMapName}
                    // Handle text inputs change
                    onChange={(e) => setNewMapName(e.target.value)}
                    // Input CSS class styling
                    className={styles.inlineInput}
                    // Input placeholder hint
                    placeholder="Merchant name (e.g. Swish)"
                  />
                  {/* Dropdown to select category */}
                  <select
                    // Bind value category id
                    value={newMapCat}
                    // Handle select index changes
                    onChange={(e) => {
                      // Extract chosen category value
                      const val = e.target.value;
                      // Check if user chose to create new category
                      if (val === 'CREATE_NEW') {
                        // Open creation modal with source type new_map
                        setActiveCreateCategoryTrigger({ type: 'new_map', key: '' });
                        // Stop execution
                        return;
                      }
                      // Update form input category selection state
                      setNewMapCat(val);
                    }}
                    // Dropdown CSS styling class
                    className={styles.inlineSelect}
                  >
                    {/* Initial default option */}
                    <option value="">-- Target Category --</option>
                    {/* Option to create a new category inline */}
                    <option value="CREATE_NEW">+ Create New Category</option>
                    {/* Map categories items options */}
                    {categories.map((cat) => (
                      // Dropdown select value option
                      <option key={cat.id} value={cat.id}>
                        {/* Print category label */}
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {/* Button trigger add mapping details rule */}
                  <button 
                    // Click handler trigger mapping save
                    onClick={handleAddManualMapping}
                    // CSS styling classes
                    className={styles.tinyBtn}
                    // Disable button if parameters resolved empty
                    disabled={!newMapName || !newMapCat}
                  >
                    {/* Button text icon label */}
                    +
                  </button>
                </div>

                {/* List Mapped Transaction items configs if mappings defined */}
                {Object.entries(pdfConfig?.mappings || {}).map(([merchant, catId]) => (
                  // Single settings layout row
                  <div key={merchant} className={styles.settingsRow}>
                    {/* Merchant description label text */}
                    <span className={styles.settingsLabel}>{merchant}</span>
                    {/* Selector element to update category mapping directly */}
                    <select
                      // Value binder category key
                      value={catId}
                      // Update manual category mappings callback
                      onChange={(e) => {
                        // Extract chosen category value
                        const val = e.target.value;
                        // Check if user chose to create new category
                        if (val === 'CREATE_NEW') {
                          // Open creation modal with source type saved_map
                          setActiveCreateCategoryTrigger({ type: 'saved_map', key: merchant });
                          // Stop execution
                          return;
                        }
                        // Update manual category mapping context
                        handleUpdateManualMapping(merchant, val);
                      }}
                      // Select category element styling classes
                      className={styles.categorySelect}
                      // Custom inline style constraints for settings rows
                      style={{ flex: 1, minWidth: '150px' }}
                    >
                      {/* Option to create a new category inline */}
                      <option value="CREATE_NEW">+ Create New Category</option>
                      {/* Loop categories dropdown values list */}
                      {categories.map((cat) => (
                        // Individual category target option
                        <option key={cat.id} value={cat.id}>
                          {/* Category label */}
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {/* Delete action button */}
                    <button 
                      // Delete manual mapping mapping key trigger
                      onClick={() => handleDeleteManualMapping(merchant)}
                      // CSS action style classes
                      className={styles.deleteActionBtn}
                    >
                      {/* Bin SVG icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {/* Trash outline path */}
                        <polyline points="3 6 5 6 21 6"></polyline>
                        {/* Bin bucket coordinates */}
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </>
              )}
            </div>

              {/* Settings Ignored Transaction Areas Block */}
              <div className={styles.settingsSection}>
                {/* Clickable section title header to collapse/expand content */}
                <h4 
                  // CSS class styling
                  className={styles.sectionTitle}
                  // Click handler to toggle collapsed state
                  onClick={() => setIgnoredCollapsed(!ignoredCollapsed)}
                  // Pointer cursor inline styling to indicate clickability
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                >
                  {/* Title text label */}
                  <span>All Saved Ignored Merchants (Skip List)</span>
                  {/* Expand/collapse status indicator arrow */}
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{ignoredCollapsed ? '▶' : '▼'}</span>
                </h4>
                {/* Render ignored list manual form and items list if the section is expanded */}
                {!ignoredCollapsed && (
                  // React Fragment wrapper
                  <>
                {/* Form to add manual ignore name rule */}
                <div className={styles.addForm}>
                  {/* Text input ignore merchant name */}
                  <input 
                    // Input type
                    type="text"
                    // Bind value index state
                    value={newIgnoreName}
                    // Handle input text changes
                    onChange={(e) => setNewIgnoreName(e.target.value)}
                    // Input CSS classes
                    className={styles.inlineInput}
                    // Input placeholder info
                    placeholder="Merchant name (e.g. Lön)"
                  />
                  {/* Button trigger add ignore mapping rule */}
                  <button 
                    // Click handler trigger ignore save
                    onClick={handleAddManualIgnore}
                    // CSS styling classes
                    className={styles.tinyBtn}
                    // Disable button if input resolved empty
                    disabled={!newIgnoreName}
                  >
                    {/* Button text icon label */}
                    +
                  </button>
                </div>

                {/* List Ignored transaction names if values present */}
                {(pdfConfig?.ignored || []).map((merchant) => (
                  // Ignored mapping row grid
                  <div key={merchant} className={styles.settingsRow}>
                    {/* Merchant description label text */}
                    <span className={styles.settingsLabel}>{merchant}</span>
                    {/* Delete action button */}
                    <button 
                      // Delete manual ignore name string trigger
                      onClick={() => handleDeleteManualIgnore(merchant)}
                      // CSS action style classes
                      className={styles.deleteActionBtn}
                    >
                      {/* Bin SVG icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {/* Trash outline path */}
                        <polyline points="3 6 5 6 21 6"></polyline>
                        {/* Bin bucket coordinates */}
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </>
              )}
            </div>
            </div>
          )}
        </div>

        {/* Modal footer controls toolbar bar */}
        <div className={styles.footer}>
          {/* Check if current step is greater than 1 */}
          {step > 1 && (
            // Render Back button to navigate to the previous step
            <button
              // Apply secondary button styles
              className={`${styles.btn} ${styles.btnSecondary}`}
              // Click handler to go back to the previous step
              onClick={() => {
                // If in step 3, go to step 2; if in step 2, go to step 1
                setStep(step === 3 ? 2 : 1);
              }}
            >
              {/* Back button text label */}
              Back
            </button>
          )}
          {/* Render cancel button in step 1 and step 2 */}
          {step < 3 ? (
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              {/* Cancel text label */}
              Cancel
            </button>
          ) : (
            // Render Finish button in step 3
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
              {/* Finish text label */}
              Finish
            </button>
          )}
          {/* Action trigger button */}
          {step === 2 && (
            // Render Import action button in footer
            <button
              // Dynamic primary styling classes
              className={`${styles.btn} ${styles.btnPrimary}`}
              // Trigger import confirmation modal
              onClick={handleImport}
              // Disable if no transactions loaded or selection check resolved empty
              disabled={loading || transactions.length === 0 || !transactions.some((tx) => tx.selected)}
            >
              {/* Action label text */}
              Import Selected
            </button>
          )}
        </div>
      </div>

      {/* Render confirmation modal overlay */}
      {showConfirmModal && (
        // Confirmation modal backdrop overlay
        <div className={styles.confirmOverlay} onClick={() => setShowConfirmModal(false)}>
          {/* Confirmation modal structure container panel */}
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            {/* Confirmation modal header toolbar banner */}
            <div className={styles.header}>
              {/* Confirmation header Title */}
              <h3 className={styles.title}>Confirm Import</h3>
            </div>
            {/* Confirmation modal body */}
            <div className={styles.body}>
              {/* Count of transactions text — filtered to current month/year and existing categories matching executeImport logic */}
              <p className={styles.pickerText} style={{ marginBottom: '0.75rem' }}>
                You are about to import {transactions.filter((tx) => tx.selected && tx.categoryId && tx.month === currentMonth && tx.year === currentYear && categories.some((c) => c.id === tx.categoryId)).length} transactions.
              </p>
              {/* Total sum text — filtered to current month/year and existing categories matching executeImport logic */}
              <p className={styles.pickerText} style={{ fontWeight: 600 }}>
                Total amount: {formatCurrency(transactions.filter((tx) => tx.selected && tx.categoryId && tx.month === currentMonth && tx.year === currentYear && categories.some((c) => c.id === tx.categoryId)).reduce((sum, tx) => sum + tx.amount, 0))}
              </p>
            </div>
            {/* Confirmation modal footer */}
            <div className={styles.footer}>
              {/* Cancel button */}
              <button 
                className={`${styles.btn} ${styles.btnSecondary}`} 
                onClick={() => setShowConfirmModal(false)}
              >
                {/* Cancel text label */}
                Cancel
              </button>
              {/* Confirm action button */}
              <button 
                className={`${styles.btn} ${styles.btnPrimary}`} 
                onClick={executeImport}
              >
                {/* Confirm text label */}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Render category creation modal when triggered inline */}
      {activeCreateCategoryTrigger && (
        <CreateCategoryModal
          // Callback to handle closing of the category creation modal
          onClose={() => {
            // Reset trigger state to close modal
            setActiveCreateCategoryTrigger(null);
          }}
          // Callback to handle category creation completion
          onCreated={(newCatId) => {
            // Check if trigger source type was a statement merchant dropdown
            if (activeCreateCategoryTrigger.type === 'merchant') {
              // Retrieve the merchant name key
              const name = activeCreateCategoryTrigger.key;
              // Clone existing mappings configuration dictionary
              const mappings = { ...(pdfConfig?.mappings || {}) };
              // Filter the merchant name out from the ignored merchants list
              const ignored = (pdfConfig?.ignored || []).filter((n) => n !== name);
              // Assign new category ID value to the mapping key
              mappings[name] = newCatId;
              // Dispatch configuration changes to context store
              updatePDFConfig({ mappings, ignored });
            // Check if trigger source type was the new mapping form dropdown
            } else if (activeCreateCategoryTrigger.type === 'new_map') {
              // Update state value for mapping form select
              setNewMapCat(newCatId);
            // Check if trigger source type was a saved mapping row dropdown
            } else if (activeCreateCategoryTrigger.type === 'saved_map') {
              // Retrieve target merchant name key
              const name = activeCreateCategoryTrigger.key;
              // Clone current mappings configuration dictionary
              const mappings = { ...(pdfConfig?.mappings || {}) };
              // Update category mapping value for merchant key
              mappings[name] = newCatId;
              // Persist updated configurations to context store
              updatePDFConfig({ mappings, ignored: pdfConfig?.ignored || [] });
            }
            // Dismiss active trigger state to close modal overlay
            setActiveCreateCategoryTrigger(null);
          }}
        />
      )}
      {/* Render configuration erase confirmation modal when active */}
      {showConfirmErase && (
        <div
          // Click handler to close modal on backdrop click
          onClick={() => setShowConfirmErase(false)}
          // Set overlay class style
          className={styles.confirmOverlay}
        >
          {/* Inner confirmation modal container card panel */}
          <div
            // Intercept bubbling click events
            onClick={(e) => e.stopPropagation()}
            // Set modal container card class style
            className={styles.confirmModal}
          >
            {/* Modal header toolbar banner */}
            <div className={styles.header}>
              {/* Heading title */}
              <h3 className={styles.title}>Erase Import Configuration</h3>
            </div>
            {/* Modal description alert body */}
            <div className={styles.body}>
              {/* Caution warning details text content */}
              <p className={styles.pickerText}>
                Are you sure you want to erase all saved merchant category mappings and ignored rules? This action cannot be undone.
              </p>
            </div>
            {/* Action buttons footer toolbar */}
            <div className={styles.footer}>
              {/* Cancel button to dismiss overlay */}
              <button
                // Set cancel button styles
                className={`${styles.btn} ${styles.btnSecondary}`}
                // Click triggers dismiss
                onClick={() => setShowConfirmErase(false)}
              >
                {/* Cancel label */}
                Cancel
              </button>
              {/* Confirm button executing configurations reset */}
              <button
                // Set primary action button style
                className={`${styles.btn} ${styles.btnPrimary}`}
                // Sizing background red color override
                style={{ backgroundColor: 'var(--firebase-red)', borderColor: 'var(--firebase-red)', color: 'white' }}
                // Click executes erase reset routine and dismisses modal
                onClick={() => {
                  // Reset configuration data in context
                  updatePDFConfig({ mappings: {}, ignored: [] });
                  // Dismiss active modal status trigger state
                  setShowConfirmErase(false);
                }}
              >
                {/* Erase confirm button label */}
                Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the Modal component for use in the app pages
export default PDFImportModal;
