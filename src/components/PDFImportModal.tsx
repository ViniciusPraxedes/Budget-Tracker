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
  // Description or name of merchant
  description: string;
  // Cost value of transaction
  amount: number;
  // Inclusion status checkbox
  selected: boolean;
  // Target Category key link
  categoryId: string;
}

// Define the property signature for the Modal component
interface PDFImportModalProps {
  // Method callback to dismiss overlay
  onClose: () => void;
}

// Implement the React functional component for bank statement importing
const PDFImportModal: React.FC<PDFImportModalProps> = ({ onClose }) => {
  // Get active categories list, addExpenses, addMissingCategories, pdfConfig, and updatePDFConfig helper from context
  const { categories, addExpenses, addMissingCategories, pdfConfig, updatePDFConfig } = useBudget();
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
  // Manage active tab panel selected ('import' | 'settings')
  const [activeTab, setActiveTab] = useState<'import' | 'settings'>('import');
  // State for new inline mapping name text input field
  const [newMapName, setNewMapName] = useState('');
  // State for new inline mapping category selection dropdown
  const [newMapCat, setNewMapCat] = useState('');
  // State for new inline ignore rule name text input field
  const [newIgnoreName, setNewIgnoreName] = useState('');
  // Manage list of unique retrieved transaction names from settings PDF import
  const [retrievedNames, setRetrievedNames] = useState<string[]>([]);
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
      // Check if any keyword matches search query
      if (keywords.some((kw) => search.includes(kw))) {
        // Find existing category matching mapped name
        const match = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        // Return category identifier if found
        if (match) return match.id;
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
    // Return first category as fallback if any exist
    return categories.length > 0 ? categories[0].id : '';
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
        // Match digits inside date string format
        const numbers = dateMatch[0].match(/\d+/g);
        // Declare day index fallback
        let paymentDay = 1;
        // Verify digits array content count
        if (numbers && numbers.length >= 2) {
          // Determine format starting with four-digit year
          if (numbers[0].length === 4) {
            // Take third segment as day
            paymentDay = parseInt(numbers[2]) || 1;
          } else {
            // Take first segment as day
            paymentDay = parseInt(numbers[0]) || 1;
          }
        }
        // Save matched date string text
        const dateStr = dateMatch[0];
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
        const savedCategoryId = pdfConfig?.mappings[cleanDesc];
        // Check if this description is flagged to ignore
        const isIgnored = pdfConfig?.ignored.includes(cleanDesc);
        // Add new transaction row data structure object
        parsedTxs.push({
          // Generate unique ID
          id: Math.random().toString(36).substr(2, 9),
          // Set raw date
          date: dateStr,
          // Constrain paymentDay between 1 and 31
          paymentDay: Math.min(Math.max(paymentDay, 1), 31),
          // Assign description
          description: cleanDesc,
          // Save absolute amount values converted to SEK
          amount: Math.abs(amountVal) * conversionRate,
          // Check true if transaction was debit negative and not ignored
          selected: isIgnored ? false : amountVal < 0,
          // Resolve matching category link using saved mappings or keyword matching
          categoryId: savedCategoryId || findMatchingCategory(cleanDesc),
        });
      }
      // Update transaction list state structure
      setTransactions(parsedTxs);
      // Set status message text helper
      setStatusMessage(`Found ${parsedTxs.length} transaction entries.`);
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
      // Create reader utility object
      const reader = new FileReader();
      // Configure file load callback handler
      reader.onload = async (event) => {
        // Verify buffer target data presence
        if (event.target?.result instanceof ArrayBuffer) {
          // Parse loaded array buffer details
          await parsePdf(event.target.result);
        }
      };
      // Trigger buffer reader on select file
      reader.readAsArrayBuffer(e.target.files[0]);
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
      // Create file reader object
      const reader = new FileReader();
      // Assign onload callback hook
      reader.onload = async (event) => {
        // Check if data is array buffer format
        if (event.target?.result instanceof ArrayBuffer) {
          // Trigger parsing
          await parsePdf(event.target.result);
        }
      };
      // Initiate buffer file read trigger
      reader.readAsArrayBuffer(e.dataTransfer.files[0]);
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

  // Import selected transaction entries into context database
  const handleImport = () => {
    // Filter active items checked selected
    const toImport = transactions.filter((tx) => tx.selected && tx.categoryId);
    // Map transactions into formatted batch expense items
    const expensesPayload = toImport.map((tx) => ({
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
    // Dismiss modal display
    onClose();
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
      // Instantiate standard file reader
      const reader = new FileReader();
      // On load reader callback
      reader.onload = async (event) => {
        // Verify output is array buffer
        if (event.target?.result instanceof ArrayBuffer) {
          // Process parsing statement logic
          await parsePdfForNames(event.target.result);
        }
      };
      // Load file as array buffer data
      reader.readAsArrayBuffer(e.target.files[0]);
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
      // Create new reader helper
      const reader = new FileReader();
      // Define loaded details callback
      reader.onload = async (event) => {
        // Verify buffer type representation
        if (event.target?.result instanceof ArrayBuffer) {
          // Retrieve transaction names
          await parsePdfForNames(event.target.result);
        }
      };
      // Initiate loading
      reader.readAsArrayBuffer(e.dataTransfer.files[0]);
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

  // Render modal layout template
  return (
    // Backdrop modal overlay wrapper
    <div className={styles.overlay} onClick={onClose}>
      {/* Modal structure container panel */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header toolbar banner */}
        <div className={styles.header}>
          {/* Header Title header */}
          <h3 className={styles.title}>Import PDF Statement</h3>
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

        {/* Navigation Tabs Bar */}
        <div className={styles.tabsContainer}>
          {/* Import tab trigger button */}
          <button 
            // Select click active tab update
            onClick={() => setActiveTab('import')} 
            // Conditional styling classes assignment
            className={`${styles.tabButton} ${activeTab === 'import' ? styles.tabButtonActive : ''}`}
          >
            {/* Tab Label */}
            Import
          </button>
          {/* Configuration Settings tab trigger button */}
          <button 
            // Select click active tab update
            onClick={() => setActiveTab('settings')} 
            // Conditional styling classes assignment
            className={`${styles.tabButton} ${activeTab === 'settings' ? styles.tabButtonActive : ''}`}
          >
            {/* Tab Label */}
            Settings Config
          </button>
        </div>

        {/* Modal scrollable main body */}
        <div className={styles.body}>
          {/* Render active import tab view panels */}
          {activeTab === 'import' ? (
            // Check loading status
            loading ? (
              // Spinner block wrapper
              <div className={styles.statusContainer}>
                {/* Spinning border indicator */}
                <div className={styles.spinner} />
                {/* Status message details */}
                <p className={styles.pickerText}>{statusMessage}</p>
              </div>
            ) : transactions.length === 0 ? (
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
                  // Filter PDF types only
                  accept="application/pdf"
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
                  Tap to choose a bank statement PDF
                </p>
                {/* Display dynamic helper status error texts */}
                {statusMessage && (
                  // Paragraph status display text
                  <p style={{ color: 'var(--firebase-red)', fontSize: '0.85rem', margin: 0 }}>
                    {/* Dynamic value */}
                    {statusMessage}
                  </p>
                )}
              </div>
            ) : (
              // Results list wrapper container
              <div className={styles.transactionList}>
                {/* Dynamic summary label row */}
                <p className={styles.pickerText} style={{ marginBottom: '0.5rem' }}>
                  {/* Render status message */}
                  {statusMessage}
                </p>
                {/* Iterate transactions row cards */}
                {transactions.map((tx) => (
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
                    {/* Text card content block */}
                    <div className={styles.cardContent}>
                      {/* Header meta detail row */}
                      <div className={styles.cardHeaderRow}>
                        {/* Date label bubble wrapper */}
                        <span className={styles.dateBubble}>
                          {/* Print raw date */}
                          {tx.date}
                        </span>
                        {/* Amount format display */}
                        <span className={styles.amount} style={{ color: tx.selected ? 'var(--firebase-yellow)' : 'var(--text-secondary)' }}>
                          {/* Formatting currency */}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                      {/* Text input details editor */}
                      <input
                        // Value binder
                        value={tx.description}
                        // Callback descriptions changes
                        onChange={(e) => handleDescriptionChange(tx.id, e.target.value)}
                        // Input classes CSS
                        className={styles.nameInput}
                        // Placeholder text hint
                        placeholder="Transaction description"
                      />
                      {/* Select category assign selector */}
                      <select
                        // Value binder category key
                        value={tx.categoryId}
                        // Category change callback handler
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        // Category select class style
                        className={styles.categorySelect}
                      >
                        {/* Unassigned initial state value dropdown options */}
                        <option value="">-- Choose Category --</option>
                        {/* Map through categories list */}
                        {categories.map((cat) => (
                          // Item choice element
                          <option key={cat.id} value={cat.id}>
                            {/* Print category label */}
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Render settings manually configurations tab view
            // Outer wrapper division for configuration options
            <div>
              {/* Configuration loader section block wrapper */}
              <div className={styles.settingsSection}>
                {/* Retrieving merchants label heading title */}
                <h4 className={styles.sectionTitle}>Retrieve Merchants from PDF</h4>
                {/* Conditional checking settings status */}
                {settingsLoading ? (
                  // Loading status block wrapper
                  <div className={styles.statusContainer}>
                    {/* Circle spin indicator */}
                    <div className={styles.spinner} />
                    {/* Processing description helper label text */}
                    <p className={styles.pickerText}>Reading PDF for merchant names...</p>
                  </div>
                ) : retrievedNames.length === 0 ? (
                  // Drag drop upload zone element wrapper
                  <div
                    // Set drag enter callback handler
                    onDragEnter={handleSettingsDrag}
                    // Set drag over browser action prevention
                    onDragOver={handleSettingsDrag}
                    // Set drag leave callback handler
                    onDragLeave={handleSettingsDrag}
                    // Set file drop callback handler
                    onDrop={handleSettingsDrop}
                    // Set touch click picker trigger
                    onClick={() => settingsFileInputRef.current?.click()}
                    // Picker zone dynamic style assignment
                    className={`${styles.pickerZone} ${settingsDragActive ? styles.pickerZoneActive : ''}`}
                  >
                    {/* Hidden system input picker element */}
                    <input
                      // Select reference selector
                      ref={settingsFileInputRef}
                      // System input type picker
                      type="file"
                      // Apply hidden class rules
                      className={styles.hiddenInput}
                      // Limit files filter extension
                      accept="application/pdf"
                      // Assign change callback handler
                      onChange={handleSettingsFileChange}
                    />
                    {/* Magnifying search icon layout SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {/* Document template border outline */}
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      {/* Corner details fold */}
                      <polyline points="14 2 14 8 20 8"></polyline>
                      {/* Glass circle shape */}
                      <circle cx="11.5" cy="13.5" r="2.5"></circle>
                      {/* Handle diagonal line */}
                      <line x1="16" y1="18" x2="13.3" y2="15.3"></line>
                    </svg>
                    {/* Helper description text */}
                    <p className={styles.pickerText}>
                      {/* Click/drag prompt */}
                      Tap or drag PDF to load merchant names
                    </p>
                  </div>
                ) : (
                  // Results box wrapper
                  <div>
                    {/* Counters row details tool wrapper */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      {/* Render names list total count */}
                      <span className={styles.pickerText}>{retrievedNames.length} unique merchants found</span>
                      {/* Clear results helper list button */}
                      <button
                        // Clear callback handler trigger
                        onClick={() => setRetrievedNames([])}
                        // Secondary styling button classes
                        className={styles.btnSecondary}
                        // Custom sizing inline style overrides
                        style={{ minHeight: '32px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        {/* Clear text label */}
                        Clear List
                      </button>
                    </div>
                    {/* Scrollable listing box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                      {/* Loop retrieved unique merchant labels */}
                      {retrievedNames.map((name) => {
                        // Check if current name exists in ignore array
                        const isIgnored = pdfConfig?.ignored.includes(name);
                        // Resolve mapped category ID if present
                        const currentCatId = pdfConfig?.mappings[name] || '';
                        // Return individual merchant row layout
                        return (
                          // Card container row
                          <div key={name} className={styles.settingsRow} style={{ padding: '0.5rem 0.75rem' }}>
                            {/* Merchant name label text */}
                            <span className={styles.settingsLabel} style={{ fontSize: '0.85rem' }}>{name}</span>
                            {/* Category map dropdown selector */}
                            <select
                              // Selected bound value
                              value={currentCatId}
                              // Selection changed update callback
                              onChange={(e) => {
                                // Extract target value string
                                const val = e.target.value;
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
                )}
              </div>
              {/* Settings Category Mappings Area Block */}
              <div className={styles.settingsSection}>
                {/* Section title label */}
                <h4 className={styles.sectionTitle}>Merchant-Category Mappings</h4>
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
                    onChange={(e) => setNewMapCat(e.target.value)}
                    // Dropdown CSS styling class
                    className={styles.inlineSelect}
                  >
                    {/* Initial default option */}
                    <option value="">-- Target Category --</option>
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
                      onChange={(e) => handleUpdateManualMapping(merchant, e.target.value)}
                      // Select category element styling classes
                      className={styles.categorySelect}
                      // Custom inline style constraints for settings rows
                      style={{ flex: 1, minWidth: '150px' }}
                    >
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
              </div>

              {/* Settings Ignored Transaction Areas Block */}
              <div className={styles.settingsSection}>
                {/* Section title label */}
                <h4 className={styles.sectionTitle}>Ignored Merchants (Skip List)</h4>
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
              </div>
            </div>
          )}
        </div>

        {/* Modal footer controls toolbar bar */}
        <div className={styles.footer}>
          {/* Dismiss button */}
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
            {/* Cancel text label */}
            Cancel
          </button>
          {/* Action trigger button */}
          {activeTab === 'import' && (
            // Render Import action button in footer
            <button
              // Dynamic primary styling classes
              className={`${styles.btn} ${styles.btnPrimary}`}
              // Trigger import action
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
    </div>
  );
};

// Export the Modal component for use in the app pages
export default PDFImportModal;
