'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Send, Phone, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/utils';
import logger from '@/lib/logger';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (phone: string, message: string) => Promise<void>;
  isRTL?: boolean;
}

export default function SendMessageModal({ 
  isOpen, 
  onClose, 
  onSend, 
  isRTL = false 
}: SendMessageModalProps) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; message?: string }>({});
  const t = useTranslations('messages');

  const validateForm = () => {
    const newErrors: { phone?: string; message?: string } = {};

    // Validate phone number
    if (!phone.trim()) {
      newErrors.phone = t('validation.phoneRequired');
    } else if (!validatePhoneNumber(phone)) {
      newErrors.phone = t('validation.invalidPhone');
    }

    // Validate message
    if (!message.trim()) {
      newErrors.message = t('validation.messageRequired');
    } else if (message.trim().length < 3) {
      newErrors.message = t('validation.messageTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Format phone number
      const formattedPhone = formatPhoneNumber(phone);

      await onSend(formattedPhone, message.trim());
      
      // Reset form
      setPhone('');
      setMessage('');
      setErrors({});
      onClose();
    } catch (error) {
      logger.error('Error sending message:', error);
      // Error handling is done by parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPhone('');
      setMessage('');
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('newMessage')}
          </DialogTitle>
          <DialogDescription>
            {t('sendViaWhatsApp')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t('phoneNumber')}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={errors.phone ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {t('messageContent')}
            </Label>
            <Textarea
              id="message"
              placeholder={t('messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`min-h-[100px] resize-none ${errors.message ? 'border-destructive' : ''}`}
              disabled={isLoading}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message}</p>
            )}
            <p className="text-xs text-ink/60">
              {message.length}/1000 {t('characters')}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={isLoading || !phone.trim() || !message.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('sending')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t('send')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
