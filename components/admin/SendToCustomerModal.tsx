

import React, { useState, useEffect, useRef } from 'react';
import * as htmlToImage from 'html-to-image';
import type { Customer, Product, Promotion, Category } from '../../types';
import { getProductsFromCache as getProducts } from '../../services/productService';
import { getPromotionsFromCache as getPromotions } from '../../services/promotionService';
import { getCategoriesFromCache as getCategories } from '../../services/categoryService';
import { CloseIcon } from '../icons/CloseIcon';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { MailIcon } from '../icons/MailIcon';
import { CopyIcon } from '../icons/CopyIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import MenuGenerator from './MenuGenerator';

interface SendToCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

type SendType = 'promotion' | 'product' | 'notice' | 'menu';

// Helper function to fetch a font file and convert it to a data URL
const fontToDataURL = (url: string, response: Response): Promise<string> => {
    return response.blob().then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }));
};

// Helper function to fetch and embed Google Fonts to avoid CORS issues
const getFontEmbedCSS = async (fontUrl: string): Promise<string> => {
    try {
        const cssResponse = await fetch(fontUrl);
        if (!cssResponse.ok) return '';

        let cssText = await cssResponse.text();
        const fontFileUrls = cssText.match(/url\((https:\/\/[^)]+)\)/g) || [];

        const fontPromises = fontFileUrls.map(async (match) => {
            const url = match.replace(/url\(([^)]+)\)/, '$1');
            try {
                const fontFileResponse = await fetch(url);
                if (fontFileResponse.ok) {
                    const dataUrl = await fontToDataURL(url, fontFileResponse);
                    cssText = cssText.replace(url, dataUrl);
                }
            } catch (error) {
                console.warn(`Could not fetch font: ${url}`, error);
            }
        });

        await Promise.all(fontPromises);
        return cssText;

    } catch (error) {
        console.error("Error fetching or processing font CSS:", error);
        return '';
    }
};


const SendToCustomerModal: React.FC<SendToCustomerModalProps> = ({ isOpen, onClose, customer }) => {
    const [sendType, setSendType] = useState<SendType>('promotion');
    const [products, setProducts] = useState<Product[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
    const [selectedItemId, setSelectedItemId] = useState('');
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [message, setMessage] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [customImageUrl, setCustomImageUrl] = useState('');
    const [isGeneratingMenu, setIsGeneratingMenu] = useState(false);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const menuRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (isOpen) {
            const allProducts = getProducts();
            const activePromotions = getPromotions().filter(p => p.isActive);
            const allCategories = getCategories();
            setProducts(allProducts);
            setPromotions(activePromotions);
            setCategories(allCategories);
            resetForm(activePromotions, allProducts);
        }
    }, [isOpen]);

    const resetForm = (activePromotions: Promotion[], allProducts: Product[]) => {
        setNoticeTitle('');
        setNoticeMessage('');
        setCustomImageUrl('');
        setImagePreviewUrl(null);
        setMessage('');
        setCopyStatus('idle');

        if (activePromotions.length > 0) {
            setSendType('promotion');
            setSelectedItemId(activePromotions[0].id);
        } else if (allProducts.length > 0) {
            setSendType('product');
            setSelectedItemId(allProducts[0].id);
        } else {
            setSendType('notice');
            setSelectedItemId('');
        }
    };

    // Effect to generate menu image
    useEffect(() => {
        if (sendType === 'menu' && menuRef.current) {
            setIsGeneratingMenu(true);
            setImagePreviewUrl(null);
            
            const generateImage = async () => {
                try {
                    const fontUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@600;700&display=swap";
                    const fontEmbedCSS = await getFontEmbedCSS(fontUrl);

                    const dataUrl = await htmlToImage.toPng(menuRef.current!, { 
                        quality: 0.95, 
                        pixelRatio: 2,
                        fontEmbedCSS: fontEmbedCSS
                    });
                    setImagePreviewUrl(dataUrl);
                } catch (err) {
                    console.error('oops, something went wrong!', err);
                    setCopyStatus('error');
                } finally {
                    setIsGeneratingMenu(false);
                }
            };
            
            setTimeout(generateImage, 200);
        }
    }, [sendType, products, promotions, categories]);


    // Effect to update image preview for non-menu types
    useEffect(() => {
        if (sendType !== 'menu') {
            if (customImageUrl.trim()) {
                setImagePreviewUrl(customImageUrl.trim());
                return;
            }
    
            let selectedItem: Product | Promotion | undefined;
            if (sendType === 'promotion') selectedItem = promotions.find(p => p.id === selectedItemId);
            else if (sendType === 'product') selectedItem = products.find(p => p.id === selectedItemId);
            
            setImagePreviewUrl(selectedItem?.imageUrl || null);
        }
    }, [customImageUrl, selectedItemId, sendType, promotions, products]);


    // Effect to generate message
    useEffect(() => {
        if (!customer) {
            setMessage('');
            return;
        }
        
        const greeting = customer.name ? `¡Hola ${customer.name.split(' ')[0]}!` : '¡Hola!';
        let finalMessage = '';

        if (sendType === 'notice') {
            finalMessage = `${greeting}\n\n*${noticeTitle}*\n\n${noticeMessage}`;
        } else if (sendType === 'menu') {
            finalMessage = `${greeting} ¡Te compartimos nuestro menú completo de Pizzería Los Genios! 🍕\n\nRevisa la imagen adjunta para ver todas nuestras delicias. ¿Qué te gustaría pedir hoy?`;
        } else {
            let selectedItem: Product | Promotion | undefined;
            if (sendType === 'promotion') selectedItem = promotions.find(p => p.id === selectedItemId);
            else selectedItem = products.find(p => p.id === selectedItemId);

            if (selectedItem) {
                const priceFormatted = `$${Number(selectedItem.price).toLocaleString('es-AR')}`;
                let description = '';
                if (sendType === 'product' && 'description' in selectedItem) {
                    description = selectedItem.description ? `\n${selectedItem.description}\n` : '';
                } else if (sendType === 'promotion' && 'items' in selectedItem) {
                    description = `\nIncluye: ${selectedItem.items.map(i => `${i.quantity}x ${i.name}`).join(' + ')}\n`;
                }
                finalMessage = `${greeting} No te pierdas esta oferta especial que tenemos para vos en Pizzería Los Genios. 🍕\n\n*${selectedItem.name}* - ${priceFormatted}${description}\n¡Haz tu pedido ahora y disfruta!`;
            }
        }
        setMessage(finalMessage);
    }, [customer, selectedItemId, sendType, products, promotions, noticeTitle, noticeMessage]);
    
    const handleTypeChange = (type: SendType) => {
        setSendType(type);
        setCustomImageUrl(''); // Clear custom image URL on type change
        if (type === 'promotion' && promotions.length > 0) setSelectedItemId(promotions[0].id);
        else if (type === 'product' && products.length > 0) setSelectedItemId(products[0].id);
        else setSelectedItemId('');
    };
    
    const handleCopyImage = async () => {
        if (!imagePreviewUrl) return;
        setCopyStatus('idle');
        try {
            // Data URLs need to be converted to blob to be copied
            const response = await fetch(imagePreviewUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to copy image: ', err);
            setCopyStatus('error');
        }
    };
    
    const handleDownloadImage = () => {
        if (!imagePreviewUrl) return;
        const link = document.createElement('a');
        link.href = imagePreviewUrl;
        link.download = `pizzeria-los-genios-${sendType}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    if (!isOpen || !customer) return null;

    const handleWhatsAppShare = () => {
        if (!customer.phone) return;
        const url = `https://api.whatsapp.com/send?phone=${customer.phone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleEmailShare = () => {
        let subject = '¡Aviso Importante de Pizzería Los Genios!';
        if (sendType === 'notice') {
            subject = noticeTitle || subject;
        } else if (sendType === 'menu') {
            subject = '¡Nuestro Menú para vos de Pizzería Los Genios!';
        } else {
            const item = sendType === 'promotion' ? promotions.find(p => p.id === selectedItemId) : products.find(p => p.id === selectedItemId);
            if (item) subject = `¡${item.name} para vos de Pizzería Los Genios!`;
        }
        const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.location.href = url;
    };
    
    return (
        <>
            {/* Hidden container for rendering the menu to be captured */}
            <div style={{ position: 'fixed', left: '-2000px', top: '0', zIndex: -1 }}>
                <div ref={menuRef}>
                    <MenuGenerator products={products} promotions={promotions} categories={categories} />
                </div>
            </div>

            <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform animate-slide-in-up max-h-[90vh] flex flex-col">
                    <header className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Enviar a {customer.name}</h2>
                        <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"><CloseIcon className="w-6 h-6" /></button>
                    </header>
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <fieldset className="flex flex-wrap gap-2">
                            <input type="radio" id="send-promo" name="sendType" value="promotion" checked={sendType === 'promotion'} onChange={() => handleTypeChange('promotion')} className="sr-only" disabled={promotions.length === 0}/>
                            <label htmlFor="send-promo" className={`px-3 py-2 text-sm rounded-lg font-semibold cursor-pointer ${sendType === 'promotion' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'} ${promotions.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Promoción</label>
                            
                            <input type="radio" id="send-product" name="sendType" value="product" checked={sendType === 'product'} onChange={() => handleTypeChange('product')} className="sr-only" disabled={products.length === 0}/>
                            <label htmlFor="send-product" className={`px-3 py-2 text-sm rounded-lg font-semibold cursor-pointer ${sendType === 'product' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'} ${products.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Producto</label>
                            
                            <input type="radio" id="send-notice" name="sendType" value="notice" checked={sendType === 'notice'} onChange={() => handleTypeChange('notice')} className="sr-only"/>
                            <label htmlFor="send-notice" className={`px-3 py-2 text-sm rounded-lg font-semibold cursor-pointer ${sendType === 'notice' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Aviso</label>
                            
                            <input type="radio" id="send-menu" name="sendType" value="menu" checked={sendType === 'menu'} onChange={() => handleTypeChange('menu')} className="sr-only" disabled={products.length === 0 && promotions.length === 0}/>
                            <label htmlFor="send-menu" className={`px-3 py-2 text-sm rounded-lg font-semibold cursor-pointer ${sendType === 'menu' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'} ${(products.length === 0 && promotions.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}>Menú Completo</label>
                        </fieldset>
                        
                        {sendType === 'notice' && (
                            <div className="space-y-2 animate-fade-in">
                                <input type="text" placeholder="Título del Aviso" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
                                <textarea placeholder="Mensaje del Aviso" value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"/>
                            </div>
                        )}
                        {(sendType === 'product' || sendType === 'promotion') && (
                            <div>
                                <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} disabled={!selectedItemId} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md disabled:opacity-50">
                                    {sendType === 'promotion' ? promotions.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        )}

                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"/>

                        {sendType !== 'menu' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL de Imagen (Opcional)</label>
                                <input type="text" placeholder="https://ejemplo.com/imagen.jpg" value={customImageUrl} onChange={(e) => setCustomImageUrl(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
                            </div>
                        )}

                        {isGeneratingMenu && (
                            <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <p>Generando imagen del menú...</p>
                            </div>
                        )}

                        {imagePreviewUrl && !isGeneratingMenu && (
                            <div className="p-3 border dark:border-gray-600 rounded-md space-y-3">
                                <img src={imagePreviewUrl} alt="Vista previa" className="max-h-48 w-auto mx-auto rounded-md" />
                                <div className="flex justify-center items-center gap-2">
                                    <button onClick={handleCopyImage} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"><CopyIcon className="w-4 h-4 mr-2"/>Copiar</button>
                                    <button onClick={handleDownloadImage} className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300"><DownloadIcon className="w-4 h-4 mr-2"/>Descargar</button>
                                    {copyStatus === 'success' && <span className="text-xs text-green-600">¡Copiado!</span>}
                                    {copyStatus === 'error' && <span className="text-xs text-red-600">Error al copiar.</span>}
                                </div>
                            </div>
                        )}
                    </div>
                    <footer className="flex flex-col sm:flex-row justify-end items-center p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg space-y-2 sm:space-y-0 sm:space-x-3">
                        <button onClick={handleWhatsAppShare} disabled={!customer.phone} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"><WhatsAppIcon className="w-5 h-5 mr-2" />Enviar por WhatsApp</button>
                        <button onClick={handleEmailShare} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-white bg-blue-600 hover:bg-blue-700"><MailIcon className="w-5 h-5 mr-2" />Enviar por Email</button>
                    </footer>
                </div>
            </div>
        </>
    );
};

export default SendToCustomerModal;
