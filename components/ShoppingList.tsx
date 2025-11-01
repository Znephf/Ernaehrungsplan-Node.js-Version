import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { ShoppingList } from '../types';
import { PrintIcon, LoadingSpinnerIcon } from './IconComponents';

interface ShoppingListComponentProps {
  shoppingList: ShoppingList;
}

const ShoppingListComponent: React.FC<ShoppingListComponentProps> = ({ shoppingList }) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  const handleToggleCheck = (item: string) => {
    setCheckedItems(prevCheckedItems => {
      const newCheckedItems = new Set(prevCheckedItems);
      if (newCheckedItems.has(item)) {
        newCheckedItems.delete(item);
      } else {
        newCheckedItems.add(item);
      }
      return newCheckedItems;
    });
  };

  const handleCreatePdf = async () => {
    const element = printableRef.current;
    if (!element) return;

    setIsCreatingPdf(true);

    const style = document.createElement('style');
    style.id = 'pdf-export-styles';
    style.innerHTML = `
      .pdf-export-mode { --tw-text-opacity: 1; color: rgb(15 23 42 / var(--tw-text-opacity)); }
      .pdf-export-mode h3 { font-size: 16px !important; }
      .pdf-export-mode li span { font-size: 12px !important; }
      .pdf-export-mode.grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    `;
    document.head.appendChild(style);
    element.classList.add('pdf-export-mode');


    const checkboxes = Array.from(element.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    
    // Checkboxes unsichtbar machen, aber Layout beibehalten
    checkboxes.forEach(cb => { cb.style.opacity = '0'; });
    
    // Give browser time to apply styles before capturing
    await new Promise(resolve => setTimeout(resolve, 50)); 
    
    const elementRect = element.getBoundingClientRect();
    const checkboxData = checkboxes.map(cb => ({
        rect: cb.getBoundingClientRect(),
        checked: cb.checked,
    }));


    try {
      const canvas = await html2canvas(element, { 
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2;
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
      const scale = contentWidth / elementRect.width;

      const totalPages = Math.ceil(imgHeight / contentHeight);
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const pageYOffset = -i * contentHeight;
        pdf.addImage(imgData, 'PNG', margin, pageYOffset + margin, contentWidth, imgHeight);

        checkboxData.forEach((cbInfo, cbIndex) => {
            const cbTopMm = (cbInfo.rect.top - elementRect.top) * scale;
            
            // Prüfen, ob die Checkbox auf der aktuellen Seite liegt
            if (cbTopMm >= i * contentHeight && cbTopMm < (i + 1) * contentHeight) {
                const xOnPage = (cbInfo.rect.left - elementRect.left) * scale + margin;
                const yOnPage = cbTopMm - (i * contentHeight) + margin;
                const sizeOnPage = cbInfo.rect.width * scale;
                
                // Erstellt eine standardkonforme Checkbox-Instanz für bessere Kompatibilität.
                // FIX: Cast to `any` to work around incorrect jspdf type definitions.
                const checkBox = new (pdf.AcroForm.CheckBox as any)();
                checkBox.fieldName = `cb_${i}_${cbIndex}`;
                checkBox.Rect = [xOnPage, yOnPage, sizeOnPage, sizeOnPage];
                checkBox.value = 'Off'; // Stellt sicher, dass die Checkbox initial leer ist.
                checkBox.appearanceState = 'Off'; // or On
                pdf.addField(checkBox);
            }
        });
      }
      
      pdf.save('einkaufsliste.pdf');
    } catch (error) {
      console.error("Konnte PDF nicht erstellen", error);
    } finally {
      // Restore styles and visibility
      element.classList.remove('pdf-export-mode');
      const tempStyle = document.getElementById('pdf-export-styles');
      if (tempStyle) tempStyle.remove();
      checkboxes.forEach(cb => { cb.style.opacity = '1'; });
      setIsCreatingPdf(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <h2 className="text-2xl font-bold text-slate-700 text-center sm:text-left">Wöchentliche Einkaufsliste</h2>
        <div className="flex flex-col sm:flex-row items-center gap-2">
           <button
            onClick={handleCreatePdf}
            disabled={isCreatingPdf}
            className="flex items-center justify-center gap-2 w-48 sm:w-40 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
          >
            {isCreatingPdf ? <LoadingSpinnerIcon /> : <PrintIcon />}
            <span>{isCreatingPdf ? 'Erstelle...' : 'PDF erstellen'}</span>
          </button>
        </div>
      </div>

      <div ref={printableRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
        {(shoppingList || []).map(({ category, items }) => (
          <div key={category} className="bg-white rounded-lg shadow-lg p-6 break-inside-avoid">
            <h3 className="text-xl font-semibold text-emerald-700 border-b-2 border-emerald-200 pb-2 mb-4">{category}</h3>
            <ul className="space-y-2">
              {Array.isArray(items) && items.map((item, index) => {
                const isChecked = checkedItems.has(item);
                return (
                  <li key={index}>
                    <label className="flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(item)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-opacity"
                        aria-labelledby={`item-${category}-${index}`}
                      />
                      <span 
                        id={`item-${category}-${index}`}
                        className={`ml-3 transition-colors ${
                          isChecked ? 'line-through text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShoppingListComponent;