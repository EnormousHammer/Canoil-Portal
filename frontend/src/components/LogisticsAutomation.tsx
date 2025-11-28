import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { Truck, FileText, Mail, Download, AlertCircle, Send, Package, CheckCircle, ExternalLink, DollarSign } from 'lucide-react';

interface EmailAnalysis {
  so_number: string;
  company_name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  destination_country?: string;
  shipping_urgency?: string;
  hazmat_mentioned?: boolean;
  special_instructions?: string;
  total_weight?: string;
  weight_per_pallet?: string;
  pallet_count?: number;
  pallet_dimensions?: string;
  packaging_type?: string; // 'case', 'pallet', or 'skid'
  skid_info?: string; // Pre-formatted packaging info (e.g., "1 box 27×22×20 inches")
  pieces_count?: number;
  batch_numbers?: string;
  carrier?: string;
  tracking_number?: string;
  ship_date?: string;
  delivery_date?: string;
  delivery_instructions?: string;
  extracted_details?: {
    ship_to_address?: string;
    delivery_date?: string;
    shipping_method?: string;
    contact_person?: string;
    items_mentioned?: string[];
    phone?: string;
    email?: string;
  };
  items?: {
    description: string;
    quantity: string;
    unit: string;
    batch_number?: string;
  }[];
}

interface GeneratedDocument {
  type: string;
  filename: string;
  download_url: string;
  content_type?: string;
  generated_at?: string;
}

const LogisticsAutomation: React.FC = () => {
  // Simplified state - only what we need
  const [emailText, setEmailText] = useState('');
  const [soFile, setSoFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Auto-detection state
  const [autoDetection, setAutoDetection] = useState<any>(null);
  const [processingMode, setProcessingMode] = useState<'auto' | 'manual'>('auto');

  // Check for email data from EmailAssistant on mount
  useEffect(() => {
    const storedEmailData = localStorage.getItem('logistics_email_data');
    const autoAnalyze = localStorage.getItem('logistics_auto_analyze');
    
    if (storedEmailData) {
      try {
        const emailData = JSON.parse(storedEmailData);
        const emailContent = `From: ${emailData.from}\nSubject: ${emailData.subject}\nDate: ${emailData.timestamp}\n\n${emailData.body}`;
        
        setEmailText(emailContent);
        
        // Clear from localStorage
        localStorage.removeItem('logistics_email_data');
        
        // Auto-analyze if enabled
        if (autoAnalyze === 'true') {
          localStorage.removeItem('logistics_auto_analyze');
          // Trigger analysis after a brief delay to ensure state is set
          setTimeout(() => {
            processLogisticsAuto();
          }, 500);
        }
        
        console.log('✅ Loaded email from Email Assistant');
      } catch (error) {
        console.error('Error loading email data:', error);
      }
    }
  }, []);

  const processLogisticsAuto = async () => {
    if (!emailText.trim()) {
      setError('Please provide email text');
      return;
    }
    
    // Clear all previous results before processing new email
    setResult(null);
    setDocuments([]);
    setError('');
    setAutoDetection(null);
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/logistics/process-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_content: emailText
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('🔍 RAW BACKEND RESPONSE:', data);
        console.log('🔍 SO DATA ITEMS COUNT:', data.so_data?.items?.length);
        console.log('🔍 SO DATA ITEMS:', data.so_data?.items);
        setResult(data);
        setAutoDetection(data.auto_detection);
        console.log('✅ Auto logistics processed successfully:', data);
      } else {
        // Handle validation errors specially
        if (data.validation_errors || data.validation_details) {
          // Use the detailed summary if available
          const errorMessage = data.validation_summary || 
            `❌ ${data.error}\n\nValidation Issues:\n${data.validation_errors.map((err: string) => `• ${err}`).join('\n')}`;
          setError(errorMessage);
          
          // Still show the data for debugging
          if (data.email_data || data.so_data) {
            setResult({
              email_data: data.email_data,
              so_data: data.so_data,
              validation_failed: true,
              validation_errors: data.validation_errors,
              validation_details: data.validation_details,
              validation_summary: data.validation_summary
            });
          }
        } else {
          setError(data.error || 'Failed to process logistics automatically');
        }
        
        if (data.auto_detection) {
          setAutoDetection(data.auto_detection);
        }
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generatePackingSlip = async () => {
    if (!result) {
      console.error('❌ No result data available for Packing Slip generation');
      return;
    }

    console.log('📦 Generating Packing Slip with data:', {
      so_data: result.so_data,
      email_shipping: result.email_shipping,
      items: result.items
    });

    setLoading(true);
    setError('');
    
    try {
      // Generate Packing Slip using GPT-4o
      const response = await fetch(getApiUrl('/api/logistics/generate-packing-slip'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          email_shipping: result.email_shipping,
          items: result.items
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setDocuments(prev => [...prev, {
          type: 'Packing Slip',
          filename: data.packing_slip_file,
          download_url: data.download_url,
          generated_at: new Date().toISOString()
        }]);
        console.log('✅ Packing Slip generated successfully:', data.packing_slip_file);
        
        // Automatically download the file
        if (data.download_url) {
          const link = document.createElement('a');
          link.href = getApiUrl(data.download_url);
          link.download = data.packing_slip_file;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        setError(data.error || 'Failed to generate Packing Slip');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateDangerousGoods = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      console.log('Generating Dangerous Goods Declaration...');
      const response = await fetch(getApiUrl('/api/logistics/generate-dangerous-goods'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          items: result.so_data?.items || result.items || [],
          email_shipping: result.email_shipping || {}
        })
      });

      const data = await response.json();
      
      if (data.success && data.dangerous_goods_files) {
        // Add all dangerous goods files to documents
        const newDocs = data.dangerous_goods_files.map((dgFile: any) => ({
          type: 'Dangerous Goods Declaration',
          filename: dgFile.filename,
          download_url: dgFile.download_url,
          generated_at: new Date().toISOString()
        }));
        
        // Add SDS files
        if (data.sds_files && Array.isArray(data.sds_files)) {
          data.sds_files.forEach((sdsFile: any) => {
            newDocs.push({
              type: 'SDS (Safety Data Sheet)',
              filename: sdsFile.filename,
              download_url: sdsFile.download_url,
              generated_at: new Date().toISOString()
            });
          });
        }
        
        // Add COFA files
        if (data.cofa_files && Array.isArray(data.cofa_files)) {
          data.cofa_files.forEach((cofaFile: any) => {
            newDocs.push({
              type: 'COFA (Certificate of Analysis)',
              filename: cofaFile.filename,
              download_url: cofaFile.download_url,
              generated_at: new Date().toISOString()
            });
          });
        }
        
        setDocuments(prev => [...prev, ...newDocs]);
        console.log(`✅ Generated ${newDocs.length} document(s) (DG + SDS + COFA)`);
        
        // Download files
        newDocs.forEach((doc: any, index: number) => {
          setTimeout(async () => {
            const fileResponse = await fetch(getApiUrl(doc.download_url));
            const blob = await fileResponse.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = doc.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(blobUrl);
            }, 100);
          }, index * 500);
        });
      } else if (data.success === false && data.message) {
        setError(data.message);
      } else {
        setError('No dangerous goods detected in this shipment');
      }
    } catch (error) {
      console.error('Error generating dangerous goods:', error);
      setError('Failed to generate dangerous goods declaration');
    } finally {
      setLoading(false);
    }
  };

  const generateCommercialInvoice = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      // Generate Commercial Invoice using GPT-4o
      const response = await fetch(getApiUrl('/api/logistics/generate-commercial-invoice'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          email_shipping: result.email_shipping,
          items: result.items
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setDocuments(prev => [...prev, {
          type: 'Commercial Invoice',
          filename: data.commercial_invoice_file,
          download_url: data.download_url,
          generated_at: new Date().toISOString()
        }]);
        console.log('✅ Commercial Invoice generated successfully:', data.commercial_invoice_file);
        
        // Automatically download the file
        if (data.download_url) {
          const link = document.createElement('a');
          link.href = getApiUrl(data.download_url);
          link.download = data.commercial_invoice_file;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        setError(data.error || 'Failed to generate Commercial Invoice');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Check if dangerous goods are present - Match backend patterns
  const hasDangerousGoods = () => {
    if (!result?.so_data?.items) {
      return false;
    }
    
    // Match backend detection patterns (from dangerous_goods_generator.py)
    const dangerousGoodsPatterns = [
      '46XC', 'REOL46XC', 'CC46XC', 'TURBOFLUID 46XC',
      '46B', 'REOL46B', 'CC46B', 'TURBOFLUID 46B',
      '32BGT', '32B GT', 'REOL32BGT', 'CC32BGT', 'TURBOFLUID 32B'
    ];
    
    return result.so_data.items.some((item: any) => {
      const itemCode = (item.item_code || '').toUpperCase();
      const description = (item.description || '').toUpperCase();
      
      return dangerousGoodsPatterns.some(pattern => {
        const patternUpper = pattern.toUpperCase();
        return itemCode.includes(patternUpper) || description.includes(patternUpper);
      });
    });
  };

  const needsUSMCA = () => {
    if (!result?.so_data) return false;
    
    // APPROVED HTS CODES on Canoil's USMCA Certificate
    // Source: backend/usmca_hts_codes.py - KEEP IN SYNC!
    const APPROVED_USMCA_HTS_CODES = [
      '2710.19.3500', // Petroleum Lubricating Grease
      '2710.19.3080', // Petroleum Oils
      '2710.19.4590', // Base oils (Cansol, Canox)
      '7310.10.0015', // Empty Metal Drum
      '3811.21.0000', // Heat transfer fluids
      '3811.90',      // Fuel system cleaning solutions
      '3403.19',      // Engine flush and lubricating oils
      '3403.19.5000'  // Biodegradable greases
    ];
    
    // USMCA 3-Part Check (matches backend validation):
    // 1. Destination must be USA (not Mexico or other countries)
    // 2. Items must have HTS codes ON THE APPROVED LIST
    // 3. Items must have North American COO (CA/US/MX)
    
    // Part 1: Check destination - ONLY USA
    const destination = (result.so_data.ship_to?.country || 
                        result.so_data.shipping_address?.country || '').toUpperCase();
    
    if (!['USA', 'US', 'UNITED STATES'].includes(destination)) {
      return false;
    }
    
    // Part 2 & 3: Check if ANY items have ALL THREE requirements
    const items = result.so_data.items || [];
    return items.some((item: any) => {
      // Must have HTS code
      const htsCode = (item.hts_code || item.HTS_code || '').trim();
      if (!htsCode) {
        return false; // No HTS code = no USMCA
      }
      
      // HTS code must be on APPROVED list (exact match or prefix match)
      const isApproved = APPROVED_USMCA_HTS_CODES.some(approvedCode => 
        htsCode === approvedCode || htsCode.startsWith(approvedCode)
      );
      if (!isApproved) {
        return false; // HTS not on approved list = no USMCA
      }
      
      // Must have North American COO
      const coo = (item.country_of_origin || '').toUpperCase();
      const northAmericanCOO = ['CA', 'US', 'MX', 'CANADA', 'USA', 'MEXICO', 'UNITED STATES'];
      
      // All three conditions must be true
      return northAmericanCOO.includes(coo);
    });
  };

  const needsTSCA = () => {
    if (!result?.so_data) return false;
    
    // TSCA only for USA shipments
    const destination = (result.so_data.ship_to?.country || 
                        result.so_data.shipping_address?.country || '').toUpperCase();
    
    return ['USA', 'US', 'UNITED STATES'].includes(destination);
  };

  const isCrossBorder = () => {
    if (!result?.so_data) return false;
    
    // Commercial Invoice only for cross-border shipments (not Canada)
    const destination = (result.so_data.ship_to?.country || 
                        result.so_data.shipping_address?.country || 
                        result.email_shipping?.destination_country ||
                        result.email_shipping?.final_destination ||
                        result.email_analysis?.destination_country ||
                        result.email_analysis?.final_destination || '').toUpperCase();
    
    // If destination is not Canada, it's cross-border
    return destination && !['CANADA', 'CA', 'CAN'].includes(destination);
  };

  const generateTSCA = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      console.log('Generating TSCA Certification...');
      const response = await fetch(getApiUrl('/api/logistics/generate-tsca'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          items: result.so_data?.items || result.items || [],
          email_analysis: result.email_analysis || result.email_data || {}
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const newDoc = {
          type: 'TSCA Certification',
          filename: data.filename,
          download_url: data.download_url,
          generated_at: new Date().toISOString()
        };
        
        setDocuments(prev => [...prev, newDoc]);
        console.log(`✅ Generated TSCA Certification: ${data.filename}`);
        
        // Download file
        const fileResponse = await fetch(getApiUrl(data.download_url));
        const blob = await fileResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } else if (data.message) {
        setError(data.message);
      } else {
        setError('Failed to generate TSCA certification');
      }
    } catch (error) {
      console.error('Error generating TSCA:', error);
      setError('Failed to generate TSCA certification. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const generateUSMCA = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      console.log('📜 Generating USMCA Certificate...');
      
      // USMCA is generated via the backend generate-all-documents endpoint
      const response = await fetch(getApiUrl('/api/logistics/generate-all-documents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data || {},
          email_shipping: result.email_shipping || {},
          email_analysis: result.email_analysis || result.email_data || {},
          items: result.so_data?.items || result.items || []
        })
      });

      const data = await response.json();
      
      if (data.success && data.results?.usmca_certificate?.success) {
        const newDoc = {
          type: 'USMCA Certificate',
          filename: data.results.usmca_certificate.filename,
          download_url: data.results.usmca_certificate.download_url,
          generated_at: new Date().toISOString()
        };
        
        setDocuments(prev => [...prev, newDoc]);
        console.log(`✅ Generated USMCA Certificate: ${data.results.usmca_certificate.filename}`);
        
        // Download file
        const fileResponse = await fetch(getApiUrl(data.results.usmca_certificate.download_url));
        const blob = await fileResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.results.usmca_certificate.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } else {
        const reason = data.results?.usmca_certificate?.reason || 'Not applicable for this shipment';
        setError(`USMCA Certificate: ${reason}`);
        console.log(`ℹ️ USMCA not generated: ${reason}`);
      }
    } catch (error) {
      console.error('Error generating USMCA:', error);
      setError('Failed to generate USMCA certificate. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const generateAllDocuments = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      // Generate ALL documents (BOL, Packing Slip, CI, Dangerous Goods if present, USMCA if needed)
      console.log('📋 === FRONTEND: PREPARING TO CALL GENERATE-ALL-DOCUMENTS ===');
      console.log('Full result object:', result);
      console.log('result.so_data:', result.so_data);
      console.log('result.so_data?.items:', result.so_data?.items);
      console.log('result.items:', result.items);
      
      const requestData = {
        so_data: result.so_data || {},
        email_shipping: result.email_shipping || {},
        email_analysis: result.email_analysis || result.email_data || {},
        items: result.so_data?.items || result.items || []
      };
      
      console.log('📤 Request data being sent:', requestData);
      console.log('📤 Items count:', requestData.items.length);
      
      const response = await fetch(getApiUrl('/api/logistics/generate-all-documents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', response.headers.get('Content-Type'));
      
      const responseText = await response.text();
      console.log('📥 Raw response (first 500 chars):', responseText.substring(0, 500));
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📥 Parsed JSON response:', data);
      } catch (parseError) {
        console.error('❌ FAILED TO PARSE JSON:', parseError);
        console.error('❌ Response was:', responseText.substring(0, 1000));
        throw new Error(`Backend returned non-JSON response: ${responseText.substring(0, 200)}`);
      }
      
      // Show what we got back
      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status, response.statusText);
        console.error('❌ Response data:', data);
      }
      
      if (data.success && data.documents) {
        const newDocs: GeneratedDocument[] = [];
        
        // Process all documents from the main documents array (includes BOL, Packing Slip, CI, DG, SDS, COFA, TSCA, USMCA)
        if (data.documents && Array.isArray(data.documents)) {
          data.documents.forEach((doc: any) => {
            newDocs.push({
              type: doc.document_type,
              filename: doc.filename,
              download_url: doc.download_url,
              generated_at: new Date().toISOString()
            });
          });
        }
        
        setDocuments(prev => [...prev, ...newDocs]);
        console.log(`✅ Generated ${newDocs.length} documents successfully`);
        
        // Download files using fetch to force actual downloads (not just opening)
        newDocs.forEach((doc, index) => {
          setTimeout(async () => {
            console.log(`📥 Downloading ${index + 1}/${newDocs.length}: ${doc.filename}`);
            
            try {
              // Fetch the file as a blob
              const fileResponse = await fetch(getApiUrl(doc.download_url));
              const blob = await fileResponse.blob();
              
              // Create a blob URL and trigger download
              const blobUrl = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = blobUrl;
              link.download = doc.filename; // This forces download dialog
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              
              // Cleanup
              setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
              }, 100);
              
              console.log(`✅ Downloaded: ${doc.filename}`);
            } catch (err) {
              console.error(`❌ Failed to download ${doc.filename}:`, err);
            }
          }, index * 800); // 800ms delay between downloads
        });
      } else {
        const errorMsg = data.error || data.summary || 'Failed to generate documents';
        setError(errorMsg);
        console.error('Generation failed:', data);
        console.error('Error message:', errorMsg);
        console.error('Full response:', JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const processLogistics = async () => {
    if (!emailText.trim() || !soFile) {
      setError('Please provide both email text and SO PDF file');
      return;
    }

    // Clear all previous results before processing new email
    setResult(null);
    setDocuments([]);
    setError('');
    setAutoDetection(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('email_text', emailText);
      formData.append('so_pdf_file', soFile);
      
      const response = await fetch(getApiUrl('/api/logistics/process-email'), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        console.log('✅ Logistics processed successfully:', data);
      } else {
        setError(data.error || 'Failed to process logistics');
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };


  const generateDocuments = async () => {
    if (!result) return;

    setLoading(true);
    setError('');
    
    try {
      console.log('🚀 Starting BOL generation...');
      console.log('📤 Request data:', {
        so_data: result.so_data,
        email_analysis: result.email_analysis || result.email_shipping
      });
      
      // Generate BOL HTML using GPT-4o field population
      const response = await fetch(getApiUrl('/api/logistics/generate-bol-html'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          so_data: result.so_data,
          email_analysis: result.email_analysis || result.email_shipping
        })
      });

      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Response data:', data);
      
      if (data.success) {
        setDocuments([{
          type: 'BOL HTML',
          filename: data.filename,
          download_url: data.download_url,
          generated_at: new Date().toISOString()
        }]);
        console.log('✅ BOL HTML generated successfully:', data.filename);
        console.log('📥 Download URL:', data.download_url);
        
        // Automatically download the file (same method as Packing Slip)
        if (data.download_url) {
          console.log('📥 Triggering download...');
          const downloadUrl = getApiUrl(data.download_url);
          console.log('📥 Full download URL:', downloadUrl);
          
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = data.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('✅ Download triggered');
        } else {
          console.warn('⚠️ No download_url in response');
        }
      } else {
        console.error('❌ BOL generation failed:', data.error);
        setError(data.error || 'Failed to generate BOL HTML');
      }
    } catch (err) {
      console.error('❌ BOL generation error:', err);
      setError('Network error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const startNewShipment = () => {
    setEmailText('');
    setSoFile(null);
    setResult(null);
    setDocuments([]);
    setError('');
    setAutoDetection(null);
    setProcessingMode('auto');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Compact Header with Mode Toggle */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Logistics</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Compact Mode Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setProcessingMode('auto')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    processingMode === 'auto'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🤖 Auto
                </button>
                <button
                  onClick={() => setProcessingMode('manual')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    processingMode === 'manual'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📁 Manual
                </button>
              </div>
              
              {/* Start New Shipment button */}
              {(result || documents.length > 0) && (
                <button
                  onClick={startNewShipment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-semibold"
                  title="Clear all data and start a new shipment"
                >
                  <Send className="w-4 h-4" />
                  New
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Compact Email Input - Prominently at Top */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Paste Email</h2>
          </div>
          
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            onKeyDown={(e) => {
              // Allow Enter to process, but Shift+Enter creates new line
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Only process if not loading and email text exists
                if (!loading && emailText.trim()) {
                  // For manual mode, also check if SO file exists
                  if (processingMode === 'manual' && !soFile) {
                    return; // Don't process if manual mode without file
                  }
                  // Trigger the appropriate process function
                  if (processingMode === 'auto') {
                    processLogisticsAuto();
                  } else {
                    processLogistics();
                  }
                }
              }
            }}
            placeholder="Paste email here and press Enter to process..."
            className="w-full p-4 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all text-gray-700 placeholder-gray-400 text-sm"
            rows={6}
            autoFocus
          />
          
          {/* Process Button */}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={processingMode === 'auto' ? processLogisticsAuto : processLogistics}
              disabled={loading || !emailText.trim() || (processingMode === 'manual' && !soFile)}
              className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                loading || !emailText.trim() || (processingMode === 'manual' && !soFile)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {processingMode === 'auto' ? 'Processing...' : 'Processing...'}
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  {processingMode === 'auto' ? '🤖 Auto Process' : 'Process'}
                </>
              )}
            </button>
            
            {processingMode === 'auto' && (
              <span className="text-xs text-gray-500">Auto-detects SO number from email</span>
            )}
          </div>
        </div>
                
        {/* Compact SO File Upload - Only show in manual mode */}
        {processingMode === 'manual' && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">SO PDF File</h2>
            </div>
            
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setSoFile(e.target.files?.[0] || null)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-sm"
            />
          </div>
        )}
                
        {/* Compact Auto-Detection Results */}
        {autoDetection && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl shadow-md p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="text-lg font-bold text-blue-900">Auto-Detected</span>
              </div>
              {autoDetection.file_path && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const pdfPath = autoDetection.file_path;
                      if (pdfPath) {
                        const encodedPath = encodeURIComponent(pdfPath);
                        const url = getApiUrl(`/api/sales-order-pdf/${encodedPath}`);
                        console.log('🌐 Opening auto-detected SO PDF:', url);
                        window.open(url, '_blank');
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white/70 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-blue-900 min-w-[70px]">SO:</span>
                <span className="text-blue-700 font-bold">{autoDetection.so_number}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-blue-900 min-w-[70px]">File:</span>
                <span className="text-blue-700 truncate">{autoDetection.filename}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xl font-bold text-red-900">Error</span>
            </div>
            <div className="bg-white/70 rounded-xl p-4 text-red-800 whitespace-pre-line font-medium">{error}</div>
          </div>
        )}
        
        {/* Validation Failed Warning */}
        {result?.validation_failed && result?.validation_details && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-red-800 font-bold text-xl">Validation Failed - Cannot Generate Documents</h3>
                <p className="text-red-600 text-sm">The email content does not match the Sales Order</p>
              </div>
            </div>
            
            {/* Validation Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* SO Number Check */}
              <div className={`border rounded-lg p-4 ${
                result.validation_details.so_number_check?.status === 'passed' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-100 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.validation_details.so_number_check?.status === 'passed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-800">SO Number</span>
                </div>
                {result.validation_details.so_number_check?.status === 'passed' ? (
                  <p className="text-sm text-green-700">✓ Matches: #{result.validation_details.so_number_check.value}</p>
                ) : (
                  <div className="text-sm text-red-700">
                    <p className="font-medium">✗ {result.validation_details.so_number_check?.message}</p>
                    {result.validation_details.so_number_check?.email_value && (
                      <p className="mt-1">Email: #{result.validation_details.so_number_check.email_value}</p>
                    )}
                    {result.validation_details.so_number_check?.so_value && (
                      <p>PDF: #{result.validation_details.so_number_check.so_value}</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Company Check */}
              <div className={`border rounded-lg p-4 ${
                result.validation_details.company_check?.status === 'passed' 
                  ? 'bg-green-50 border-green-200' 
                  : result.validation_details.company_check?.status === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-100 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.validation_details.company_check?.status === 'passed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-800">Company</span>
                </div>
                {result.validation_details.company_check?.status === 'passed' ? (
                  <p className="text-sm text-green-700">✓ Matches</p>
                ) : (
                  <div className="text-sm text-red-700">
                    <p className="font-medium">✗ {result.validation_details.company_check?.message}</p>
                  </div>
                )}
              </div>
              
              {/* Items Check */}
              <div className={`border rounded-lg p-4 ${
                result.validation_details.items_check?.status === 'passed' 
                  ? 'bg-green-50 border-green-200' 
                  : result.validation_details.items_check?.status === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-100 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.validation_details.items_check?.status === 'passed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-800">Items</span>
                </div>
                {result.validation_details.items_check?.status === 'passed' ? (
                  <p className="text-sm text-green-700">✓ {result.validation_details.items_check.message}</p>
                ) : result.validation_details.items_check?.status === 'warning' ? (
                  <p className="text-sm text-yellow-700">{result.validation_details.items_check.message}</p>
                ) : (
                  <div className="text-sm text-red-700">
                    <p className="font-medium">
                      ✗ {result.validation_details.items_check?.matched_items || 0}/{result.validation_details.items_check?.total_email_items || 0} matched
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Unmatched Items Details */}
            {result.validation_details.items_check?.unmatched_items && result.validation_details.items_check.unmatched_items.length > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-red-800 mb-2">Unmatched Items from Email:</h4>
                <ul className="space-y-2">
                  {result.validation_details.items_check.unmatched_items.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">•</span>
                      <div className="text-sm">
                        <span className="font-medium text-gray-800">{item.email_item}</span>
                        {item.quantity && <span className="text-gray-600 ml-2">Qty: {item.quantity}</span>}
                        {item.batch && <span className="text-gray-600 ml-2">Batch: {item.batch}</span>}
                        <p className="text-red-600 text-xs mt-1">{item.error}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-4 p-4 bg-red-100 rounded-lg border border-red-300">
              <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Processing has been stopped to prevent incorrect document generation.
              </p>
              <p className="text-xs text-red-700 mt-1">
                Please ensure the email refers to the correct Sales Order and all items match.
              </p>
            </div>
          </div>
        )}

        {/* Enterprise Results Display */}
        {result && (
          <div className="space-y-5">
            {/* Header with Status */}
            <div className="bg-gradient-to-br from-white via-white to-blue-50/30 border border-slate-200 rounded-lg shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-full blur-3xl"></div>
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg shadow-sm">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Logistics Data Extraction Complete</h2>
                    <p className="text-sm text-slate-600">Data extracted from SO #{result.so_data?.so_number || result.email_analysis?.so_number} and shipping email</p>
                    <div className="flex gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-blue-500" />
                        <span>Email parsed successfully</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span>SO PDF analyzed</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  {/* SO Viewer */}
                  {result?.so_pdf_file && (
                    <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-semibold text-slate-700">SO Document</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const pdfPath = result.so_pdf_file;
                            if (pdfPath) {
                              const encodedPath = encodeURIComponent(pdfPath);
                              const url = getApiUrl(`/api/sales-order-pdf/${encodedPath}`);
                              console.log('🌐 Opening SO PDF in browser:', url);
                              window.open(url, '_blank');
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-all hover:shadow-md flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View PDF
                        </button>
                        <button 
                          onClick={() => {
                            const pdfPath = result.so_pdf_file;
                            if (pdfPath) {
                              window.open(`file:///${pdfPath.replace(/\\/g, '/')}`, '_blank');
                            }
                          }}
                          className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-all hover:shadow-md flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Open File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                      </div>
                        </div>

            {/* PARTIAL SHIPMENT WARNING - STANDALONE BEFORE COMPARISON */}
            {result.so_data?.is_partial_shipment && result.so_data?.line_numbers && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-900 mb-2">⚠️ PARTIAL SHIPMENT ALERT</h3>
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      This shipment is for <span className="bg-amber-100 px-2 py-1 rounded text-amber-900 border border-amber-200">LINE {result.so_data.line_numbers.join(', ')} ONLY</span>
                    </p>
                    <p className="text-xs text-amber-700 mt-2">
                      All pricing, quantities, and totals shown below are calculated for the selected line(s) only and include 13% Canadian HST.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Data Comparison Section - NEW */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/20 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-100 p-1 rounded">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-slate-900">Data Comparison</h3>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2.5 py-1 rounded font-semibold shadow-sm">EMAIL</span>
                    <span className="text-xs text-slate-400">vs</span>
                    <span className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white px-2.5 py-1 rounded font-semibold shadow-sm">SO PDF</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Email Data Column */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm pb-3 border-b border-slate-200">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      From Email (Carolina)
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">SO Number:</span>
                        <span className="font-medium">{result.email_data?.so_number || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Company:</span>
                        <span className="font-medium">{result.email_data?.company_name || 'Not specified'}</span>
                      </div>
                      {result.email_data?.po_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">PO Number:</span>
                          <span className="font-medium">{result.email_data.po_number}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Weight:</span>
                        <span className="font-medium">{result.email_data?.total_weight || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          {result.email_data?.packaging_type === 'case' ? 'Box/Case:' : 'Pallets:'}
                        </span>
                        <span className="font-medium">
                          {result.email_data?.packaging_type === 'case' 
                            ? (result.email_data?.skid_info || result.email_data?.pallet_count || 'Not specified')
                            : (result.email_data?.pallet_count || 'Not specified')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Batch #:</span>
                        <span className="font-medium font-mono">{result.email_data?.batch_numbers || 'Not specified'}</span>
                      </div>
                      {result.email_data?.carrier && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Carrier:</span>
                          <span className="font-medium">{result.email_data.carrier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* SO Data Column */}
                  <div className="space-y-3 bg-slate-50 p-5 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm pb-3 border-b border-slate-200">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      From SO PDF
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">SO Number:</span>
                        <span className="font-medium">{result.so_data?.so_number || 'Not found'}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer:</span>
                        <span className="font-medium">{result.so_data?.customer_name || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">PO Number:</span>
                        <span className="font-medium">{result.so_data?.po_number || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order Date:</span>
                        <span className="font-medium">{result.so_data?.order_date || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ship Date:</span>
                        <span className="font-medium">{result.so_data?.due_date || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Terms:</span>
                        <span className="font-medium">{result.so_data?.terms || 'Not found'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Items Count:</span>
                        <span className="font-medium">
                          {result.so_data?.items?.filter((item: any) => {
                            const itemCode = item.item_code?.toLowerCase() || '';
                            const description = item.description?.toLowerCase() || '';
                            
                            // Exclude charges/fees only
                            const isCharge = (
                              itemCode === 'pallet' ||
                              itemCode === 'brokerage charge' ||
                              itemCode === 'freight charge' ||
                              description.includes('charge') ||
                              description.includes('pallet') ||
                              description.includes('brokerage') ||
                              description.includes('freight') ||
                              description.includes('prepaid')
                            );
                            
                            return !isCharge;
                          }).length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Match Status */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    {result.email_data?.so_number === result.so_data?.so_number ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">SO Numbers Match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-yellow-700 font-medium">SO Number Mismatch - Please Verify</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Data Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Order Information Card */}
              <div className="bg-white border-l-4 border-l-blue-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-1 rounded">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Order Information</h3>
                    </div>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">SO PDF</span>
                          </div>
                        </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SO Number</label>
                      <div className="text-lg font-semibold text-gray-900">{result.so_data?.so_number || result.email_analysis?.so_number || 'N/A'}</div>
                        </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Order Date</label>
                      <div className="text-lg font-semibold text-gray-900">{result.so_data?.order_date || 'N/A'}</div>
                      </div>
                    </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</label>
                    <div className="text-lg font-semibold text-gray-900">{result.so_data?.billing_address?.company || result.so_data?.customer_name || result.email_analysis?.customer_name || 'N/A'}</div>
                    {result.so_data?.customer_name && result.so_data?.billing_address?.company && result.so_data.customer_name !== result.so_data.billing_address.company && (
                      <div className="text-xs text-gray-500 mt-1">Contact: {result.so_data.customer_name}</div>
                    )}
                          </div>
                  <div className="grid grid-cols-2 gap-4">
                          <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">PO Number</label>
                      <div className="text-sm font-medium text-gray-700">{result.email_data?.po_number || result.so_data?.po_number || 'N/A'}</div>
                          </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Business #</label>
                      <div className="text-sm font-medium text-gray-700">{result.so_data?.business_number || 'N/A'}</div>
                        </div>
                      </div>
                            </div>
                          </div>

              {/* Addresses Card */}
              <div className="bg-white border-l-4 border-l-blue-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200">
                                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-1 rounded">
                        <Truck className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Addresses</h3>
                    </div>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">SO PDF</span>
                                  </div>
                                      </div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Billing Address</label>
                                  </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div className="font-medium">{result.so_data?.billing_address?.company || 'N/A'}</div>
                      {result.so_data?.billing_address?.contact && (
                        <div className="text-gray-600">Attn: {result.so_data?.billing_address?.contact}</div>
                      )}
                      <div>{result.so_data?.billing_address?.street || result.so_data?.billing_address?.address || 'N/A'}</div>
                      <div>{result.so_data?.billing_address?.city || 'N/A'}, {result.so_data?.billing_address?.province || 'N/A'} {result.so_data?.billing_address?.postal || result.so_data?.billing_address?.postal_code || 'N/A'}</div>
                      <div className="text-gray-500">{result.so_data?.billing_address?.country || 'N/A'}</div>
                      {result.so_data?.billing_address?.phone && (
                        <div className="text-gray-600">Tel: {result.so_data?.billing_address?.phone}</div>
                      )}
                                </div>
                                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shipping Address</label>
                                      </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div className="font-medium">{result.so_data?.shipping_address?.company || 'N/A'}</div>
                      {result.so_data?.shipping_address?.contact && (
                        <div className="text-gray-600">Attn: {result.so_data?.shipping_address?.contact}</div>
                      )}
                      <div>{result.so_data?.shipping_address?.street || result.so_data?.shipping_address?.address || 'N/A'}</div>
                      <div>{result.so_data?.shipping_address?.city || 'N/A'}, {result.so_data?.shipping_address?.province || 'N/A'} {result.so_data?.shipping_address?.postal || result.so_data?.shipping_address?.postal_code || 'N/A'}</div>
                      <div className="text-gray-500">{result.so_data?.shipping_address?.country || 'N/A'}</div>
                      {result.so_data?.shipping_address?.phone && (
                        <div className="text-gray-600">Tel: {result.so_data?.shipping_address?.phone}</div>
                      )}
                                  </div>
                                </div>
                              </div>
                        </div>

              {/* Shipping Details Card - Enhanced with all email data */}
              <div className="bg-white border-l-4 border-l-orange-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-100 p-1 rounded">
                        <Package className="w-4 h-4 text-orange-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Email Shipping Details</h3>
                    </div>
                    <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">FROM EMAIL</span>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Weight</label>
                      <div className="text-lg font-semibold text-gray-900">
                        {result.email_data?.total_weight || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {result.email_data?.packaging_type === 'case' ? 'Box/Case' : 'Pallets'}
                      </label>
                      <div className="text-lg font-semibold text-gray-900">
                        {result.email_data?.packaging_type === 'case'
                          ? (result.email_data?.skid_info || result.email_data?.pallet_count || 'N/A')
                          : (result.email_data?.pallet_count || result.email_shipping?.pallet_info?.count || 'N/A')}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Batch Numbers</label>
                    <div className="text-sm font-mono bg-gray-100 px-3 py-2 rounded border">
                      {result.email_data?.items?.map((item: any) => item.batch_number).filter(Boolean).join(', ') || 
                       result.email_shipping?.batch_numbers || 
                       'See items below'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {result.email_data?.packaging_type === 'case' ? 'Box Dimensions' : 'Pallet Dimensions'}
                    </label>
                    <div className="text-sm font-medium text-gray-700">
                      {result.email_data?.skid_info 
                        ? result.email_data.skid_info 
                        : (result.email_data?.pallet_dimensions || result.email_shipping?.pallet_info?.dimensions || 'N/A')}
                    </div>
                  </div>
                  {result.email_data?.special_instructions && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Special Instructions</label>
                      <div className="text-sm text-gray-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                        {result.email_data.special_instructions}
                      </div>
                    </div>
                  )}
                  {result.email_data?.ship_date && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ship Date</label>
                        <div className="text-sm font-medium text-gray-700">{result.email_data.ship_date}</div>
                      </div>
                      {result.email_data?.delivery_date && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery Date</label>
                          <div className="text-sm font-medium text-gray-700">{result.email_data.delivery_date}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email Items from Parsing - NEW SECTION */}
            {result.email_data?.items && result.email_data.items.length > 0 && (
              <div className="bg-white border-l-4 border-l-orange-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-100 p-1 rounded">
                        <Mail className="w-4 h-4 text-orange-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Items Mentioned in Email</h3>
                    </div>
                    <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">FROM EMAIL</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.email_data.items.map((item: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="font-bold text-slate-900 text-sm">{item.description}</div>
                        <div className="text-xs text-slate-600 mt-2 flex items-center gap-2">
                          <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-semibold border border-orange-200">Qty: {item.quantity} {item.unit}</span>
                          {item.batch_number && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-200">Batch: {item.batch_number}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Complete Email Analysis Card - NEW */}
            {result.email_data && (
              <div className="bg-white border-l-4 border-l-orange-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-orange-100 p-1 rounded">
                        <Mail className="w-4 h-4 text-orange-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Complete Email Analysis</h3>
                    </div>
                    <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">PARSED</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(result.email_data).map(([key, value]) => {
                      if (key === 'items' || key === 'extracted_details' || value === null || value === undefined) return null;
                      return (
                        <div key={key} className="bg-slate-50 pl-3 py-2 rounded border-l-2 border-l-orange-400">
                          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{String(value)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Items and Financial Row */}
            <div className="grid grid-cols-1 xl:grid-cols-7 gap-5">
              {/* Items Table */}
              <div className="xl:col-span-5 bg-white border-l-4 border-l-blue-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-1 rounded">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {result.so_data?.customer_name || 'Customer'}'s Sales Order Items for SO {result.so_data?.so_number || '#'}
                      </h3>
                    </div>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium shadow-sm">SO PDF</span>
                  </div>
                </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">HTS Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Batch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                      {result.so_data?.items && result.so_data.items.length > 0 ? (
                        (() => {
                          console.log('SO ITEMS DEBUG:', result.so_data.items.length, 'items:', result.so_data.items);
                          return result.so_data.items;
                        })().map((item: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900 max-w-md">{item.description || 'N/A'}</div>
                              {item.item_code && item.item_code !== 'N/A' && item.item_code.trim() !== '' && (
                                <div className="text-xs text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded inline-block font-medium">Code: {item.item_code}</div>
                              )}
                                </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">{item.quantity || 'N/A'} {item.unit || ''}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {item.hts_code ? (
                                <>
                                  <div className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-200 shadow-sm">{item.hts_code}</div>
                                  {item.hts_description && (
                                    <div className="text-xs text-slate-500 truncate max-w-32 mt-1" title={item.hts_description}>
                                      {item.hts_description}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-slate-400 text-xs">-</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              <div className="font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded inline-block border border-blue-200 shadow-sm">{item.batch_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                              {item.unit_price ? `$${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">
                              {item.total_price ? `$${item.total_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                            </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No items found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                  </div>
                </div>
                
              {/* Financial Summary */}
              <div className="xl:col-span-2 bg-white border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-100 p-1 rounded">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">Order Total</h3>
                    </div>
                    {result.so_data?.is_partial_shipment && (
                      <p className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        ⚠️ Partial Shipment - Line {result.so_data?.line_numbers?.join(', ')} Only
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="p-5">
                  {/* Show recalculated partial shipment totals OR original totals */}
                  {result.so_data?.is_partial_shipment ? (
                    <div className="space-y-5">
                      {/* Line Items Subtotal */}
                      <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                        <div>
                          <div className="text-sm font-medium text-gray-600">Line Items Subtotal</div>
                          <div className="text-xs text-gray-500">Line {result.so_data?.line_numbers?.join(', ')}</div>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          {result.so_data?.subtotal?.startsWith?.('$') 
                            ? result.so_data.subtotal 
                            : (result.so_data?.subtotal 
                                ? `$${parseFloat(result.so_data.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                : '$0.00')}
                        </span>
                      </div>
                      
                      {/* Tax */}
                      <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                        <div>
                          <div className="text-sm font-medium text-gray-600">Canadian HST</div>
                          <div className="text-xs text-gray-500">13% Tax</div>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          {result.so_data?.hst?.startsWith?.('$') 
                            ? result.so_data.hst 
                            : (result.so_data?.hst 
                                ? `$${parseFloat(result.so_data.hst).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                : '$0.00')}
                        </span>
                      </div>
                      
                      {/* Business Number */}
                      {result.so_data?.business_number && (
                        <div className="flex justify-between items-center py-2 text-xs text-gray-500">
                          <span>Business #</span>
                          <span>{result.so_data.business_number}</span>
                        </div>
                      )}
                      
                      {/* Grand Total */}
                      <div className="mt-5 pt-4 border-t-2 border-slate-200">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 shadow-md">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-xs text-emerald-100 font-semibold uppercase tracking-wide">TOTAL AMOUNT</div>
                              <div className="text-xs text-emerald-200 mt-0.5">Incl. 13% HST</div>
                            </div>
                            <span className="text-3xl font-bold text-white">
                              {result.so_data?.total || '$0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Subtotal</span>
                        <span className="text-base font-semibold text-gray-900">
                          {(() => {
                            // Calculate subtotal from items if not provided
                            const subtotal = result.so_data?.subtotal ?? 
                              (result.so_data?.items?.reduce((sum: number, item: any) => sum + (item.amount || item.total_price || 0), 0) || 0);
                            return typeof subtotal === 'number' || !isNaN(parseFloat(subtotal))
                              ? `$${parseFloat(subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : 'N/A';
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Tax</span>
                        <span className="text-base font-semibold text-gray-900">
                          {typeof result.so_data?.tax === 'number' || (result.so_data?.tax && !isNaN(parseFloat(result.so_data.tax)))
                            ? `$${parseFloat(result.so_data.tax).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'N/A'}
                        </span>
                      </div>
                      {result.so_data?.business_number && (
                        <div className="flex justify-between items-center py-2 text-xs text-gray-500">
                          <span>Business #</span>
                          <span>{result.so_data.business_number}</span>
                        </div>
                      )}
                      <div className="mt-5 pt-4 border-t-2 border-slate-200">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 shadow-md">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-emerald-100 font-semibold uppercase tracking-wide">TOTAL</span>
                            <span className="text-3xl font-bold text-white">
                              {(() => {
                                // Calculate total from subtotal + tax, or from items if not provided
                                const subtotal = result.so_data?.subtotal ?? 
                                  (result.so_data?.items?.reduce((sum: number, item: any) => sum + (item.amount || item.total_price || 0), 0) || 0);
                                const tax = result.so_data?.tax || 0;
                                const total = result.so_data?.total_amount || (parseFloat(subtotal) + parseFloat(tax));
                                return typeof total === 'number' || !isNaN(parseFloat(total))
                                  ? `$${parseFloat(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : 'N/A';
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
                
            {/* Special Instructions */}
            {result.so_data?.special_instructions && result.so_data.special_instructions !== 'N/A' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-amber-50 px-6 py-4 border-b border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h3 className="font-semibold text-gray-900">Special Instructions</h3>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">SO PDF</span>
                      </div>
                  </div>
                  <div className="p-6">
                  <div className="text-sm text-gray-700 bg-amber-50 p-4 rounded-lg border border-amber-200">
                    {result.so_data.special_instructions}
                    </div>
                        </div>
                      </div>
                    )}

            {/* Action Buttons */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="space-y-5">
                {/* Main status */}
                <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-blue-50/30 p-3.5 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <div className="bg-emerald-500 p-1.5 rounded-full shadow-sm">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold">Data extraction complete</span>
                    </div>
                    <div className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm">
                      SO: {result.verification_details?.email_so_number} | PDF: {result.verification_details?.pdf_so_number}
                    </div>
                  </div>
                </div>
                
                {/* Primary Action - Generate All Documents */}
                <div className="border-t border-slate-200 pt-5">
                  <button
                    onClick={generateAllDocuments}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:bg-slate-400 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                    title="Generate All Documents (BOL, Packing Slip, Commercial Invoice) - Auto-detects and includes Dangerous Goods & USMCA if applicable"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Generating All Documents...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Generate All Documents for This Shipment</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-600 mt-2.5 text-center bg-slate-50 py-2 px-3 rounded border border-slate-200">
                    <span className="font-semibold">Auto-detects:</span> BOL, Packing Slip{isCrossBorder() ? ', Commercial Invoice' : ''}, Dangerous Goods (if applicable), TSCA (cross-border), USMCA (if HTS matches)
                  </p>
                </div>
                
                {/* Individual Document Buttons */}
                <div className="border-t border-slate-200 pt-5">
                  <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-200">
                    <p className="text-sm text-slate-700 font-semibold">Or generate documents individually:</p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={generateDocuments}
                      disabled={loading}
                      className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                      title="Generate Bill of Lading only"
                    >
                      <Package className="w-4 h-4" />
                      BOL
                    </button>
                    
                    <button
                      onClick={generatePackingSlip}
                      disabled={loading || !result}
                      className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                      title="Generate Packing Slip only"
                    >
                      <FileText className="w-4 h-4" />
                      Packing Slip
                    </button>
                    
                    {/* Commercial Invoice Button - Only show for cross-border shipments */}
                    {isCrossBorder() && (
                      <button
                        onClick={generateCommercialInvoice}
                        disabled={loading || !result}
                        className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                        title="Generate Commercial Invoice only (cross-border shipments)"
                      >
                        <FileText className="w-4 h-4" />
                        Commercial Invoice
                      </button>
                    )}
                    
                    {/* Dangerous Goods Button - Only show if items contain DG */}
                    {hasDangerousGoods() && (
                      <button
                        onClick={generateDangerousGoods}
                        disabled={loading || !result}
                        className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                        title="Generate Dangerous Goods Declaration"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Dangerous Goods
                      </button>
                    )}
                    
                    {/* USMCA Certificate Button - Only show if shipment qualifies */}
                    {needsUSMCA() && (
                      <button
                        onClick={generateUSMCA}
                        disabled={loading || !result}
                        className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                        title="Generate USMCA Certificate of Origin"
                      >
                        <FileText className="w-4 h-4" />
                        USMCA
                      </button>
                    )}
                    
                    {/* TSCA Certification Button - Only show for USA shipments */}
                    {needsTSCA() && (
                      <button
                        onClick={generateTSCA}
                        disabled={loading || !result}
                        className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm hover:shadow text-sm"
                        title="Generate TSCA Certification (US shipments)"
                      >
                        <FileText className="w-4 h-4" />
                        TSCA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Documents */}
        {documents.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-5 bg-gradient-to-r from-emerald-50 to-blue-50/30 p-3.5 rounded-lg border border-emerald-200">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 rounded-lg shadow-sm">
                <Download className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Generated Documents</h2>
              <span className="ml-auto bg-blue-600 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm">{documents.length} {documents.length === 1 ? 'File' : 'Files'}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc, index) => (
                <div key={index} className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                          <div className="flex-1">
                      <h3 className="font-bold text-slate-900 capitalize text-sm mb-1">{doc.type.replace('_', ' ')}</h3>
                      <p className="text-xs text-slate-600 font-mono bg-white px-2 py-1 rounded inline-block border border-slate-200">{doc.filename}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          console.log(`📥 Downloading: ${doc.filename}`);
                          console.log(`🔗 URL: ${doc.download_url}`);
                          
                          // Ensure we have the full URL
                          const fullUrl = doc.download_url.startsWith('http') 
                            ? doc.download_url 
                            : getApiUrl(doc.download_url);
                          
                          console.log(`🌐 Full URL: ${fullUrl}`);
                          
                          // Use fetch to download the file
                          const response = await fetch(fullUrl);
                          
                          if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                          }
                          
                          const blob = await response.blob();
                          const blobUrl = window.URL.createObjectURL(blob);
                          
                          // Create download link
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = doc.filename;
                          link.style.display = 'none';
                          document.body.appendChild(link);
                          link.click();
                          
                          // Cleanup
                          setTimeout(() => {
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(blobUrl);
                          }, 100);
                          
                          console.log(`✅ Downloaded: ${doc.filename}`);
                        } catch (error) {
                          console.error(`❌ Download failed for ${doc.filename}:`, error);
                          alert(`Download failed for ${doc.filename}:\n${(error as Error).message}`);
                        }
                      }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg ml-3"
                    >
                      <Download className="w-4 h-4" />
                      <span className="font-medium text-sm">Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LogisticsAutomation;
