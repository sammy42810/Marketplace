'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {authFetch} from '@/lib/authFetch';
import styles from './ListingForm.module.css';

const CATEGORIES = [
  'electronics', 'furniture', 'textbooks', 'clothing',
  'tickets', 'sports', 'home', 'other'
];

const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function validMoney(value) {
  const amount = Number(value);

  return Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1000000000 &&
    Math.abs(Math.round(amount * 100) - amount * 100) <= 0.000001;
}

export default function ListingForm({listing = null}) {
  const router = useRouter();
  const editing = listing !== null;

  const [form, setForm] = useState({
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    category: listing?.category ?? '',
    condition: listing?.condition ?? '',
    price: listing?.price ?? '',
    zip: listing?.zip ?? '',
    saleType: listing?.saleType ?? 'offer',
    startsAt: localDate(listing?.startsAt),
    endsAt: localDate(listing?.endsAt),
    minIncrement: listing?.minIncrement ?? ''
  });

  const [photos, setPhotos] = useState(listing?.photos ?? []);
  const [dragIndex, setDragIndex] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const {name, value} = event.target;
    setForm(previous => ({...previous, [name]: value}));
  }

  function removePhoto(index) {
    setPhotos(previous => previous.filter((_, i) => i !== index));
  }

  function reorderPhotos(index) {
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...photos];
    const [photo] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, photo);

    setPhotos(updated);
    setDragIndex(null);
  }

  function validate() {
    if (!form.title.trim() || form.title.trim().length > 100) {
      return 'Title must be between 1 and 100 characters.';
    }

    if (!form.description.trim() || form.description.trim().length > 5000) {
      return 'Description must be between 1 and 5000 characters.';
    }

    if (!CATEGORIES.includes(form.category)) {
      return 'Select a valid category.';
    }

    if (!CONDITIONS.includes(form.condition)) {
      return 'Select a valid condition.';
    }

    if (!validMoney(form.price)) {
      return 'Enter a valid positive price with up to two decimal places.';
    }

    if (!/^\d{5}$/.test(form.zip)) {
      return 'ZIP code must be 5 digits.';
    }

    if (photos.length > 8) {
      return 'You can have a maximum of 8 photos.';
    }

    if (!editing && form.saleType === 'auction') {
      const now = Date.now();
      const start = form.startsAt
        ? new Date(form.startsAt).getTime()
        : now;
      const end = new Date(form.endsAt).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return 'Enter valid auction dates.';
      }

      if (start < now - 60000) {
        return 'Start time cannot be in the past.';
      }

      const duration = end - start;

      if (duration < 60000 || duration > 30 * 24 * 60 * 60 * 1000) {
        return 'Auctions must run between 1 minute and 30 days.';
      }

      if (!validMoney(form.minIncrement)) {
        return 'Enter a valid minimum bid increment.';
      }
    }

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      condition: form.condition,
      price: Number(form.price),
      zip: form.zip,
      photos
    };

    if (!editing) {
      body.saleType = form.saleType;

      if (form.saleType === 'auction') {
        if (form.startsAt) {
          body.startsAt = new Date(form.startsAt).toISOString();
        }

        body.endsAt = new Date(form.endsAt).toISOString();
        body.minIncrement = Number(form.minIncrement);
      }
    }

    setLoading(true);

    try {
      const url = editing
        ? `/api/listings/${listing._id}`
        : '/api/listings';

      const data = await authFetch(url, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body)
      });

      router.push(`/listings/${data.listing._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h1>{editing ? 'Edit listing' : 'Create listing'}</h1>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <fieldset disabled={loading} className={styles.fields}>
        <label>
          Title
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            maxLength={100}
            required
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            maxLength={5000}
            rows={5}
            required
          />
        </label>

        <div className={styles.row}>
          <label>
            Category
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="">Select category</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            Condition
            <select
              name="condition"
              value={form.condition}
              onChange={handleChange}
              required
            >
              <option value="">Select condition</option>
              {CONDITIONS.map(condition => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Sale type
          <select
            name="saleType"
            value={form.saleType}
            onChange={handleChange}
            disabled={editing}
          >
            <option value="offer">Offer</option>
            <option value="auction">Auction</option>
          </select>
        </label>

        <div className={styles.row}>
          <label>
            {form.saleType === 'auction' ? 'Starting bid ($)' : 'Price ($)'}
            <input
              type="number"
              name="price"
              min="0.01"
              max="1000000000"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            ZIP code
            <input
              name="zip"
              value={form.zip}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={5}
              required
            />
          </label>
        </div>

        {form.saleType === 'auction' && (
          <div className={styles.auction}>
            <h2>Auction details</h2>

            <label>
              Start time (optional)
              <input
                type="datetime-local"
                name="startsAt"
                value={form.startsAt}
                onChange={handleChange}
                disabled={editing}
              />
            </label>

            <label>
              End time
              <input
                type="datetime-local"
                name="endsAt"
                value={form.endsAt}
                onChange={handleChange}
                disabled={editing}
                required
              />
            </label>

            <label>
              Minimum increment ($)
              <input
                type="number"
                name="minIncrement"
                min="0.01"
                step="0.01"
                value={form.minIncrement}
                onChange={handleChange}
                disabled={editing}
                required
              />
            </label>
          </div>
        )}

        <section>
          <h2>Photos ({photos.length}/8)</h2>
          <p>Drag photos to change their order.</p>

          <div className={styles.photos}>
            {photos.map((photo, index) => (
              <div
                key={`${photo.full}-${index}`}
                className={styles.photo}
                draggable={!loading}
                onDragStart={() => setDragIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => reorderPhotos(index)}
                onDragEnd={() => setDragIndex(null)}
              >
                <img src={photo.thumb} alt={`Listing photo ${index + 1}`} />

                <button type="button" onClick={() => removePhoto(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading
            ? 'Saving...'
            : editing
              ? 'Save changes'
              : 'Create listing'}
        </button>
      </fieldset>
    </form>
  );
}
