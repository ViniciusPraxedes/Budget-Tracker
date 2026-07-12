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
  // Flag indicating if this transaction is a duplicate of an existing expense
  isDuplicate?: boolean;
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
  // Manage toggle for grouping by merchant in the UI
  const [groupByMerchant, setGroupByMerchant] = useState(false);
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
  // Manage settings configurations step 3 sort order
  const [step3SortOrder, setStep3SortOrder] = useState<'asc' | 'desc'>('asc');
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

  // State to track which merchants should have their transactions grouped
  const [groupedMerchants, setGroupedMerchants] = useState<Record<string, boolean>>({});

  // Ref to track if we've already cleared configurations on mount
  const hasClearedConfig = useRef(false);

  // Erase all saved merchant configurations on mount to ensure a fresh new state for each import session
  React.useEffect(() => {
    // Only update if not already empty to prevent infinite re-renders
    if (!hasClearedConfig.current) {
      if (Object.keys(pdfConfig?.mappings || {}).length > 0 || (pdfConfig?.ignored || []).length > 0) {
        updatePDFConfig({ mappings: {}, ignored: [] });
      }
      hasClearedConfig.current = true;
    }
  }, [pdfConfig, updatePDFConfig]);

  // Trigger hook to verify and create Uncategorized category on mount
  React.useEffect(() => {
    if (!categories.some((cat) => cat.name === 'Uncategorized')) {
      addMissingCategories([{ name: 'Uncategorized', color: '#9E9E9E' }]);
    }
  }, [categories, addMissingCategories]);

  // Helper function to parse base merchant name and expected transaction count from a grouped expense description
  const parseGroupedExpenseName = (name: string) => {
    // Match name against regular expression checking for the count suffix pattern
    const match = name.match(/^(.+)\s+\((\d+)\s+transactions?\)$/i);
    // If pattern matches successfully
    if (match) {
      // Return parsed result object containing base name and integer count
      return {
        // Store normalized trimmed base merchant name
        baseName: match[1].trim().toLowerCase(),
        // Store parsed integer count value
        count: parseInt(match[2], 10)
      };
    }
    // Return null if pattern does not match
    return null;
  };

  // Helper to detect duplicate transactions against existing expenses in the current month
  const detectDuplicates = (rows: ParsedTx[]): ParsedTx[] => {
    // Clone the existing expenses list to use as a consumption pool
    const pool = categories.flatMap((cat) => {
      // Map over each expense in the category
      return cat.expenses.map((exp) => {
        // Return matching fields structure
        return {
          // Store ID field
          id: exp.id,
          // Store name field
          name: exp.name,
          // Store amount value
          amount: exp.amount,
          // Store paymentDay value
          paymentDay: exp.paymentDay
        };
      });
    });
    // Helper function to escape special regex characters
    const escapeRegExp = (str: string) => {
      // Return escaped regex matching patterns
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    // Helper function to check if names match exactly or as grouped versions
    const isNameMatch = (existingName: string, importDesc: string) => {
      // Normalize existing name to lowercase trimmed text
      const normExisting = existingName.trim().toLowerCase();
      // Normalize imported description to lowercase trimmed text
      const normImport = importDesc.trim().toLowerCase();
      // Check for exact matching values
      if (normExisting === normImport) {
        // Return true if identical
        return true;
      }
      // Construct regex expression checking grouped transactions suffix mapping
      const groupedRegex = new RegExp(`^${escapeRegExp(normImport)}\\s+\\(\\d+\\s+transactions?\\)$`);
      // Return regex matching boolean status evaluation
      return groupedRegex.test(normExisting);
    };
    // Initialize all rows with default duplicate status set to false
    const processedRows = rows.map((tx) => {
      // Return transaction with duplicate status fields
      return {
        // Spread transaction details
        ...tx,
        // Initialize duplicate flag status
        isDuplicate: false
      };
    });
    // First pass: Match individual transactions against individual or single-transaction grouped expenses
    processedRows.forEach((tx) => {
      // Find index of matching expense in the pool
      const matchIdx = pool.findIndex((exp) => {
        // Match payment day value
        const dayMatch = exp.paymentDay === tx.paymentDay;
        // Match amount value within small float range
        const amountMatch = Math.abs(exp.amount - tx.amount) < 0.01;
        // Match name values using helper function
        const nameMatch = isNameMatch(exp.name, tx.description);
        // Return matched evaluation status
        return dayMatch && amountMatch && nameMatch;
      });
      // Verify if a valid match is found in the pool
      if (matchIdx !== -1) {
        // Remove matched item from pool to avoid double-matching duplicates
        pool.splice(matchIdx, 1);
        // Mark transaction duplicate flag as true
        tx.isDuplicate = true;
        // Unselect duplicate items by default
        tx.selected = false;
      }
    });
    // Map containing arrays of unmatched transactions grouped by normalized description
    const unmatchedByMerchant: Record<string, typeof processedRows> = {};
    // Populate the unmatched transactions map
    processedRows.forEach((tx) => {
      // Check if transaction was not marked as duplicate
      if (!tx.isDuplicate) {
        // Normalize description text to lowercase trimmed string
        const normDesc = tx.description.trim().toLowerCase();
        // Check if map doesn't have list for description
        if (!unmatchedByMerchant[normDesc]) {
          // Initialize empty array for description
          unmatchedByMerchant[normDesc] = [];
        }
        // Push transaction to description list
        unmatchedByMerchant[normDesc].push(tx);
      }
    });
    // Second pass: Match remaining unmatched transactions against multi-transaction grouped expenses in pool
    for (let i = pool.length - 1; i >= 0; i--) {
      // Retrieve current expense from pool
      const exp = pool[i];
      // Attempt to parse grouped expense metadata details
      const parsedGroup = parseGroupedExpenseName(exp.name);
      // Check if expense was parsed as a grouped expense
      if (parsedGroup) {
        // Extract base name and expected transaction count
        const { baseName, count: expectedCount } = parsedGroup;
        // Get unmatched candidate transactions list for base merchant name
        const candidateTxs = unmatchedByMerchant[baseName];
        // Check if candidate list exists and has at least the expected count of transactions
        if (candidateTxs && candidateTxs.length >= expectedCount) {
          // Initialize variable to store matched subset array
          let matchedSubset = null;
          // Loop to search through sliding windows of candidate transactions
          for (let start = 0; start <= candidateTxs.length - expectedCount; start++) {
            // Slice candidate subset of expected count size
            const subset = candidateTxs.slice(start, start + expectedCount);
            // Calculate total amount sum of current subset
            const totalAmount = subset.reduce((sum, t) => sum + t.amount, 0);
            // Retrieve payment day of first transaction in subset
            const firstDay = subset[0].paymentDay;
            // Check if total amount matches grouped expense amount
            const amountMatch = Math.abs(totalAmount - exp.amount) < 0.01;
            // Check if first payment day matches grouped expense payment day
            const dayMatch = firstDay === exp.paymentDay;
            // If both amount and day match successfully
            if (amountMatch && dayMatch) {
              // Assign matched subset
              matchedSubset = subset;
              // Break loop as match is found
              break;
            }
          }
          // Check if a matching subset was found
          if (matchedSubset) {
            // Mark every transaction in subset as duplicate
            matchedSubset.forEach((tx) => {
              // Set duplicate status to true
              tx.isDuplicate = true;
              // Unselect duplicate items by default
              tx.selected = false;
            });
            // Filter out matched transactions from the candidates list
            unmatchedByMerchant[baseName] = candidateTxs.filter((t) => {
              // Return true if candidate is not in matched subset
              return !matchedSubset.includes(t);
            });
            // Remove matched grouped expense from pool
            pool.splice(i, 1);
          }
        }
      }
    }
    // Return processed transactions array
    return processedRows;
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
          // Set selected state - deselect all by default as requested
          selected: false,
          // Assign resolved category ID
          categoryId: '',
          // Assign transaction type
          type: txType
        });
      }
      // Update transactions state list with duplicate-checked elements
      setTransactions(detectDuplicates(parsedRows));
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
          // Set selected state - deselect all by default as requested
          selected: false,
          // Assign resolved category ID
          categoryId: '',
          // Assign transaction type
          type: txType
        });
      }
      // Update transactions state list with duplicate-checked elements
      setTransactions(detectDuplicates(parsedRows));
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
      // Check for Euro symbols or keywords with word boundaries
      if (/\beur\b/i.test(fullText) || fullText.includes('€')) {
        // Set conversion rate from EUR to SEK
        conversionRate = 11.5;
      // Check for US Dollar symbols or keywords with word boundaries
      } else if (/\busd\b/i.test(fullText) || fullText.includes('$')) {
        // Set conversion rate from USD to SEK
        conversionRate = 10.5;
      // End of currency conversion check block
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
          // Set selected state - deselect all by default as requested
          selected: false,
          // Resolve matching category link using saved mappings or keyword matching
          categoryId: '',
          // Assign transaction type
          type: txType
        });
      }
      // Update transaction list state structure with duplicate-checked elements
      setTransactions(detectDuplicates(parsedTxs));
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

  // Toggle selection status of all transactions for a merchant
  const toggleSelectMerchant = (merchantName: string) => {
    const isCurrentlySelected = transactions.some((tx) => tx.description === merchantName && tx.selected);
    const targetState = !isCurrentlySelected;
    setTransactions(
      transactions.map((tx) =>
        tx.description === merchantName ? { ...tx, selected: targetState } : tx
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

  // Proceed to configuration step after confirming selections
  const executeImport = () => {
    // Dismiss confirmation modal
    setShowConfirmModal(false);
    // Extract unique merchant names for step 3 configuration from selected transactions only
    const toImport = transactions.filter((tx) => tx.selected);
    const uniqueNames = new Set(toImport.map((tx) => tx.description));
    setRetrievedNames(Array.from(uniqueNames));
    // Proceed to configuration step 3
    setStep(3);
  };

  // Perform actual import operation saving config and inserting selected expenses
  const handleFinish = () => {
    // Filter active items checked selected
    const toImport = transactions.filter((tx) => tx.selected);

    // Grouping logic based on groupedMerchants state
    const processedTransactions: typeof toImport = [];
    const groupData: Record<string, { tx: typeof toImport[0], count: number, total: number }> = {};

    for (const tx of toImport) {
      if (groupedMerchants[tx.description]) {
        if (!groupData[tx.description]) {
          groupData[tx.description] = { tx, count: 0, total: 0 };
        }
        groupData[tx.description].count += 1;
        groupData[tx.description].total += tx.amount;
      } else {
        processedTransactions.push(tx);
      }
    }

    Object.values(groupData).forEach((data) => {
      processedTransactions.push({
        ...data.tx,
        amount: data.total,
        description: `${data.tx.description} (${data.count} transactions)`,
      });
    });

    // Find Uncategorized category ID
    const uncategorizedCat = categories.find((c) => c.name === 'Uncategorized');
    const fallbackCatId = uncategorizedCat?.id || categories[0]?.id || '';
    
    // Map transactions into formatted batch expense items
    const expensesPayload = processedTransactions.map((tx) => {
      // Need to use the original description for mapping since we appended "(x transactions)"
      const originalDesc = tx.description.replace(/\s\(\d+\stransactions\)$/, '');
      // Map category ID based on configured mappings or fallback
      const mappedCatId = pdfConfig?.mappings?.[originalDesc] || fallbackCatId;
      return {
        // Target category ID
        categoryId: mappedCatId,
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
      };
    });
    // Check if there are any items to import
    if (expensesPayload.length > 0) {
      // Trigger batch expenses addition helper function
      addExpenses(expensesPayload);
    }
    // Close the import modal completely
    onClose();
  };

  // Import selected transaction entries into context database
  const handleImport = () => {
    // Extract all selected transactions
    const selectedTxs = transactions.filter((tx) => tx.selected);
    // Block import if no transactions are selected
    if (selectedTxs.length === 0) {
      // Show error message
      setStatusMessage("No transactions selected to import.");
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
    // Allow all transaction dates
    const matchesMonthYear = true;
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

  // Group filtered transactions by merchant description
  const groupedTransactions = React.useMemo(() => {
    // Record groups keyed by merchant description
    const groups: { [key: string]: { description: string; count: number; amount: number; selected: boolean; duplicateCount: number; isDuplicate: boolean } } = {};
    // Loop over filtered transactions list
    for (const tx of filteredTransactions) {
      // Check if group structure doesn't exist
      if (!groups[tx.description]) {
        // Initialize group structure
        groups[tx.description] = {
          // Store description
          description: tx.description,
          // Initialize count
          count: 0,
          // Initialize amount
          amount: 0,
          // Initialize selected
          selected: false,
          // Initialize duplicateCount
          duplicateCount: 0,
          // Initialize isDuplicate
          isDuplicate: false
        };
      }
      // Increment group count
      groups[tx.description].count += 1;
      // Accumulate group amount
      groups[tx.description].amount += tx.amount;
      // Check if current transaction is duplicate
      if (tx.isDuplicate) {
        // Increment duplicate count in group
        groups[tx.description].duplicateCount += 1;
      }
      // Check if transaction is selected
      if (tx.selected) {
        // Toggle group selection true
        groups[tx.description].selected = true;
      }
    }
    // Loop over grouped entries to determine group duplicate status
    Object.values(groups).forEach((g) => {
      // Group is duplicate if all transactions are duplicates
      g.isDuplicate = g.duplicateCount === g.count;
    });
    // Return array of group objects
    return Object.values(groups);
  }, [filteredTransactions]);

  // Count how many loaded transactions belong to other months (disabled)
  const otherMonthsCount = 0;

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

  // Filter unique retrieved merchant names based on search query and sort alphabetically
  const filteredRetrievedNames = retrievedNames
    // Filter by search query matches
    .filter((name) => {
      // Convert search query to lower case and check inclusion
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      // Return search match result
      return matchesSearch;
      // Close filter callback
    })
    // Sort array elements alphabetically based on sort order state
    .sort((a, b) => {
      // Check if sort order matches desc
      if (step3SortOrder === 'desc') {
        // Sort descending (Z to A)
        return b.localeCompare(a);
        // End condition
      }
      // Default sort ascending (A to Z)
      return a.localeCompare(b);
      // Close sort callback
    });

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
                  placeholder="Search merchant..."
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
                <span className={styles.pickerText} style={{ marginLeft: '0.5rem' }}>
                  {/* Print summary text */}
                  {filteredTransactions.length}/{transactions.length}
                </span>
                {/* Toggle Grouping Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={groupByMerchant} 
                    onChange={(e) => setGroupByMerchant(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  Group by Merchant
                </label>
                {/* Toggle Select All checkboxes button trigger */}
                <button
                  // Click handler callback to toggle checkbox select all state
                  onClick={() => {
                    // Extract non-duplicate filtered transactions
                    const nonDuplicates = filteredTransactions.filter((tx) => !tx.isDuplicate);
                    // Verify if all non-duplicate transactions are currently selected
                    const allSelected = nonDuplicates.length > 0 && nonDuplicates.every((tx) => tx.selected);
                    // Map transactions to toggle checked state on filtered matches
                    setTransactions(
                      // Map over each transaction to toggle selected state
                      transactions.map((tx) => {
                        // Determine if current transaction is filtered
                        const isFiltered = filteredTransactions.some((ft) => ft.id === tx.id);
                        // Check if transaction is filtered
                        if (isFiltered) {
                          // Check if transaction is duplicate
                          if (tx.isDuplicate) {
                            // Force duplicate transaction to remain deselected
                            return { ...tx, selected: false };
                          }
                          // Return transaction with toggled selection state
                          return { ...tx, selected: !allSelected };
                        }
                        // Return unmodified transaction
                        return tx;
                      })
                    );
                  }}
                  // Secondary styling button class
                  className={styles.btnSecondary}
                  // Sizing adjustments inline styles overrides
                  style={{ minHeight: '32px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                >
                  {/* Conditional labels */}
                  {filteredTransactions.filter((tx) => !tx.isDuplicate).length > 0 && filteredTransactions.filter((tx) => !tx.isDuplicate).every((tx) => tx.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Scrollable list containing filtered transaction entries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groupByMerchant ? (
                  groupedTransactions.map((group) => (
                    // Transaction card container with dynamic duplicate style class
                    <div key={group.description} className={`${styles.transactionCard} ${group.isDuplicate ? styles.duplicateCard : ''}`}>
                      {/* Checkbox wrapper division */}
                      <div className={styles.checkboxContainer} onClick={() => toggleSelectMerchant(group.description)}>
                        {/* Checkbox input element */}
                        <input
                          type="checkbox"
                          checked={group.selected}
                          onChange={() => {}}
                          className={styles.checkbox}
                        />
                      </div>
                      {/* Card contents flex container */}
                      <div className={styles.cardContent} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                        {/* Text descriptions column layout */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                          {/* Heading line container with optional badge tags */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Merchant description label */}
                            <span className={styles.pickerText} style={{ fontWeight: 500, color: '#fff', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {group.description}
                            </span>
                            {/* Render duplicate badge if group is fully duplicate */}
                            {group.isDuplicate && (
                              // Already Imported warning badge
                              <span className={styles.duplicateBadge}>
                                Already Imported
                              </span>
                            )}
                            {/* Render warning badge if group contains some duplicates */}
                            {!group.isDuplicate && group.duplicateCount > 0 && (
                              // Partial duplicate badge indicator
                              <span className={styles.duplicateBadge} style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#ffb74d', borderColor: 'rgba(255, 152, 0, 0.2)' }}>
                                Contains duplicates
                              </span>
                            )}
                          </div>
                          {/* Suffix transaction count description */}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {group.count} transaction{group.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {/* Formatted amount value display */}
                        <span className={styles.amount} style={{ color: group.selected ? 'var(--firebase-yellow)' : 'var(--text-secondary)', flexShrink: 0 }}>
                          {formatCurrency(group.amount)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  filteredTransactions.map((tx) => (
                    // Transaction card container with dynamic duplicate style class
                    <div key={tx.id} className={`${styles.transactionCard} ${tx.isDuplicate ? styles.duplicateCard : ''}`}>
                      {/* Checkbox wrapper division */}
                      <div className={styles.checkboxContainer} onClick={() => toggleSelect(tx.id)}>
                        {/* Checkbox input element */}
                        <input
                          type="checkbox"
                          checked={tx.selected}
                          onChange={() => {}}
                          className={styles.checkbox}
                        />
                      </div>
                      {/* Card contents flex container */}
                      <div className={styles.cardContent} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                        {/* Text descriptions column layout */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                          {/* Heading line container with optional badge tag */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Merchant description label */}
                            <span className={styles.pickerText} style={{ fontWeight: 500, color: '#fff', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.description}
                            </span>
                            {/* Render duplicate badge if transaction is already imported */}
                            {tx.isDuplicate && (
                              // Already Imported warning badge
                              <span className={styles.duplicateBadge}>
                                Already Imported
                              </span>
                            )}
                          </div>
                          {/* Date details label description */}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {tx.date}
                          </span>
                        </div>
                        {/* Formatted amount value display */}
                        <span className={styles.amount} style={{ color: tx.selected ? 'var(--firebase-yellow)' : 'var(--text-secondary)', flexShrink: 0 }}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Render settings manually configurations wizard step 3
            // Outer wrapper division for configuration options
            <div>
              {/* Filter controls row styled exactly like step 2 */}
              <div className={styles.filterBar}>
                {/* Text search filter input field */}
                <input
                  // Bind search text query state
                  value={searchQuery}
                  // Input changes callback handler
                  onChange={(e) => setSearchQuery(e.target.value)}
                  // Search query text input placeholder
                  placeholder="Search merchant..."
                  // Custom filter input class styling
                  className={styles.filterInput}
                />
                {/* Container for select dropdown inputs to align them in a row */}
                <div className={styles.filterSelectGroup}>
                  {/* Filter dropdown selection for merchant selection state */}
                  <select
                    // Bind sort order key value
                    value={step3SortOrder}
                    // Selector changed callback handler
                    onChange={(e) => setStep3SortOrder(e.target.value as any)}
                    // Select element class styling
                    className={styles.filterSelect}
                    // Full width styling layout override
                    style={{ width: '100%' }}
                  >
                    {/* Option for alphabetical sorting A to Z */}
                    <option value="asc">Alphabetical: A to Z</option>
                    {/* Option for alphabetical sorting Z to A */}
                    <option value="desc">Alphabetical: Z to A</option>
                  </select>
                </div>
              </div>

              {/* Selection summary statistics row toolbar styled exactly like step 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0 0.75rem 0' }}>
                {/* Count of merchants text */}
                <span className={styles.pickerText} style={{ marginLeft: '0.5rem' }}>
                  {filteredRetrievedNames.length}/{retrievedNames.length}
                </span>
                {/* Container for toolbar actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Toggle Select All checkboxes button trigger for step 3 */}
                  <button
                    // Click handler callback to toggle active/ignored select all state
                    onClick={() => {
                      // Check if all filtered retrieved names are active (not ignored)
                      const allSelected = filteredRetrievedNames.every((name) => !pdfConfig?.ignored.includes(name));
                      // Clone current mappings configuration
                      const mappings = { ...(pdfConfig?.mappings || {}) };
                      // Declare updated ignored elements list
                      let ignored: string[];
                      // Check if currently all selected
                      if (allSelected) {
                        // Ignore all filtered merchants by combining ignored array
                        ignored = Array.from(new Set([...(pdfConfig?.ignored || []), ...filteredRetrievedNames]));
                        // Loop and delete mappings for all filtered merchants
                        filteredRetrievedNames.forEach((name) => {
                          // Clear mapping key
                          delete mappings[name];
                        // End loop
                        });
                      // Else branch when not all selected
                      } else {
                        // Un-ignore all filtered merchants by filtering them out of ignored list
                        ignored = (pdfConfig?.ignored || []).filter((n) => !filteredRetrievedNames.includes(n));
                      // End condition
                      }
                      // Dispatch changes to update configuration context
                      updatePDFConfig({ mappings, ignored });
                    // Close click handler
                    }}
                    // Secondary styling button class
                    className={styles.btnSecondary}
                    // Sizing adjustments inline styles overrides matching step 2 with fixed width
                    style={{ minHeight: '32px', width: '110px', padding: '0.25rem 0', fontSize: '0.8rem', textAlign: 'center' }}
                  >
                    {/* Conditional labels based on whether all filtered merchants are active */}
                    {filteredRetrievedNames.every((name) => !pdfConfig?.ignored.includes(name)) ? 'Deselect All' : 'Select All'}
                  {/* End button */}
                  </button>
                  {/* Toggle Group All / Ungroup All button */}
                  <button
                    // Click handler callback to toggle Group/Ungroup All
                    onClick={() => {
                      // Extract the list of active (non-ignored) filtered merchants
                      const activeFiltered = filteredRetrievedNames.filter((name) => !pdfConfig?.ignored.includes(name));
                      // Check if all active filtered merchants are currently grouped
                      const allGrouped = activeFiltered.length > 0 && activeFiltered.every((name) => !!groupedMerchants[name]);
                      // Clone current grouped merchants state
                      const updatedGrouped = { ...groupedMerchants };
                      // Loop through the active filtered merchants list
                      activeFiltered.forEach((name) => {
                        // Toggle grouped state to the opposite of allGrouped
                        updatedGrouped[name] = !allGrouped;
                      // End of active filtered merchants loop
                      });
                      // Update state hook with new grouped merchants dictionary
                      setGroupedMerchants(updatedGrouped);
                    // End of click handler callback
                    }}
                    // Set button className to secondary button style
                    className={styles.btnSecondary}
                    // Set styling configuration overrides matching other buttons
                    style={{ minHeight: '32px', width: '110px', padding: '0.25rem 0', fontSize: '0.8rem', textAlign: 'center' }}
                  >
                    {/* Check if all active filtered merchants are grouped to select correct label */}
                    {filteredRetrievedNames.filter((name) => !pdfConfig?.ignored.includes(name)).length > 0 &&
                    filteredRetrievedNames.filter((name) => !pdfConfig?.ignored.includes(name)).every((name) => !!groupedMerchants[name])
                      ? 'Ungroup All'
                      : 'Group All'}
                  {/* End button */}
                  </button>
                  {/* Reset button executing configurations erase styled exactly like step 2's button */}
                  <button
                    // Click trigger opens configurations reset confirm modal
                    onClick={() => setShowConfirmErase(true)}
                    // Secondary styling button class
                    className={styles.btnSecondary}
                    // Sizing adjustments inline styles overrides matching step 2 but with red colors and fixed width
                    style={{ minHeight: '32px', width: '110px', padding: '0.25rem 0', fontSize: '0.8rem', borderColor: 'rgba(244, 67, 54, 0.4)', color: '#ff5252', textAlign: 'center' }}
                  >
                    {/* Reset button text label */}
                    Reset
                  </button>
                {/* End container */}
                </div>
              </div>

              {/* Scrollable list containing merchant entries styled exactly like step 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Loop retrieved unique merchant labels */}
                {filteredRetrievedNames.map((name) => {
                  // Check if current name exists in ignore array
                  const isIgnored = pdfConfig?.ignored.includes(name);
                  // Resolve mapped category ID if present
                  const currentCatId = pdfConfig?.mappings[name] || '';
                  // Determine if mapped category ID still exists in the categories list
                  const isMappedCatDeleted = currentCatId !== '' && !categories.some((c) => c.id === currentCatId);
                  // Return individual merchant row layout
                  return (
                    // Card container row styled exactly like step 2
                    <div key={name} className={styles.transactionCard}>
                      {/* Checkbox Container for Ignore/Active state */}
                      <div
                        // Click handler to toggle active/ignored config status
                        onClick={() => {
                          // Clone mappings configuration structure
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
                        // Styled checkbox container matching step 2
                        className={styles.checkboxContainer}
                      >
                        {/* Active status checkbox input indicator */}
                        <input
                          // Input type checkbox
                          type="checkbox"
                          // Checked status based on active mapping (not ignored)
                          checked={!isIgnored}
                          // Inline click is handled by outer container
                          onChange={() => {}}
                          // Styled checkbox matching step 2
                          className={styles.checkbox}
                          // Pointer touch cursor override style
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                      {/* Card Content containing title, group checkbox and select dropdown */}
                      <div
                        // Styled responsive card content layout
                        className={styles.cardContentRow}
                      >
                        {/* Inner vertical details flex column layout */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                          {/* Merchant description/name heading label */}
                          <span
                            // Styled picker text matching step 2
                            className={styles.pickerText}
                            // Style text opacity based on ignore state
                            style={{ fontWeight: 500, color: '#fff', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: isIgnored ? 0.5 : 1 }}
                          >
                            {/* Merchant name text */}
                            {name}
                          {/* End merchant description span */}
                          </span>
                        {/* End vertical details div */}
                        </div>
                        {/* Action controls container for checkbox and dropdown */}
                        <div className={styles.cardActions}>
                          {/* Toggle group transactions checkbox label layout wrapper */}
                          <label
                            // Inline style layout and opacity based on ignore state
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', opacity: isIgnored ? 0.5 : 1, whiteSpace: 'nowrap' }}
                          >
                            {/* Group checkbox input element */}
                            <input
                              // Input type checkbox
                              type="checkbox"
                              // Checked status bound to local group status
                              checked={!!groupedMerchants[name]}
                              // Disable input interaction if ignored
                              disabled={isIgnored}
                              // State change updates groupedMerchants hook state
                              onChange={(e) => setGroupedMerchants(prev => ({ ...prev, [name]: e.target.checked }))}
                              // Touch pointer layout override
                              style={{ cursor: 'pointer' }}
                            />
                            {/* Checkbox label text */}
                            Group Transactions
                          {/* End label */}
                          </label>
                          {/* Category map dropdown selector component */}
                          <select
                            // Selected bound category ID value
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
                            // Standard categories select input styling matching step 2
                            className={styles.categorySelect}
                            // Disable dropdown interaction if ignored
                            disabled={isIgnored}
                            // Dynamic inline style adjustments based on active settings
                            style={{
                              // Set red / secondary / yellow text color dynamically
                              color: isMappedCatDeleted ? 'var(--firebase-red)' : (isIgnored ? 'var(--text-secondary)' : (currentCatId ? 'var(--firebase-yellow)' : 'var(--text-secondary)')),
                              // Set red / secondary / yellow border color dynamically
                              borderColor: isMappedCatDeleted ? 'rgba(244, 67, 54, 0.4)' : (isIgnored ? 'rgba(255, 255, 255, 0.05)' : (currentCatId ? 'rgba(255, 204, 0, 0.3)' : 'rgba(255, 255, 255, 0.15)')),
                              // Set red / secondary / yellow background color dynamically
                              backgroundColor: isMappedCatDeleted ? 'rgba(244, 67, 54, 0.05)' : (isIgnored ? 'transparent' : (currentCatId ? 'rgba(255, 204, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)')),
                              // Set element opacity based on ignore state
                              opacity: isIgnored ? 0.5 : 1
                              // Close style object
                            }}
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
                          {/* End category select */}
                          </select>
                          {/* End action controls container */}
                        </div>
                        {/* End cardContent container */}
                      </div>
                      {/* End transactionCard container */}
                    </div>
                  );
                })}
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleFinish}>
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
            <div className={styles.body}>
              {/* Count of transactions text - filtered to current month/year and existing categories matching executeImport logic */}
              <p className={styles.pickerText} style={{ marginBottom: '0.75rem' }}>
                You are about to import {transactions.filter((tx) => tx.selected).length} transactions.
              </p>
              {/* Total sum text - filtered to current month/year and existing categories matching executeImport logic */}
              <p className={styles.pickerText} style={{ fontWeight: 600 }}>
                Total amount: {formatCurrency(transactions.filter((tx) => tx.selected).reduce((sum, tx) => sum + tx.amount, 0))}
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
              {/* Reset heading title */}
              <h3 className={styles.title}>Reset Import Configuration</h3>
            </div>
            {/* Modal description alert body */}
            <div className={styles.body}>
              {/* Reset category mappings warning description text */}
              <p className={styles.pickerText}>
                Are you sure you want to reset all category mappings?
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
                  // Reset configuration data in context by clearing mappings and ignoring all retrieved merchants
                  updatePDFConfig({ mappings: {}, ignored: retrievedNames });
                  // Reset the group transactions checkbox states for all merchants
                  setGroupedMerchants({});
                  // Dismiss active modal status trigger state
                  setShowConfirmErase(false);
                }}
              >
                {/* Reset confirm button label */}
                Reset
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
