import test from 'node:test'
import assert from 'node:assert/strict'
import { partDisplayImage, resolvePartDisplayGallery } from './productImage.js'

test('partDisplayImage keeps absolute image URL', () => {
  const part = {
    name: 'Brake Pad',
    imageUrl: 'https://cdn.example.com/p/brake.jpg',
    imageKey: 'brakes',
  }
  const img = partDisplayImage(part)
  assert.equal(img.src, 'https://cdn.example.com/p/brake.jpg')
})

test('resolvePartDisplayGallery prioritizes listing primary image', () => {
  const part = {
    name: 'Oil Filter',
    imageUrl: '/api/v1/public/uploads/vehicles/p1/main.jpg',
    galleryUrls: [{ src: 'uploads/vehicles/p1/extra.jpg', alt: 'Extra' }],
    imageKey: 'filter',
  }
  const gallery = resolvePartDisplayGallery(part)
  assert.equal(gallery[0].src, '/api/v1/public/uploads/vehicles/p1/main.jpg')
})

test('resolvePartDisplayGallery falls back when no uploaded image exists', () => {
  const part = { name: 'Spark Plug', imageKey: 'spark' }
  const gallery = resolvePartDisplayGallery(part)
  assert.equal(gallery.length > 0, true)
  assert.equal(typeof gallery[0].src, 'string')
})
