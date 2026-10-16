import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import Grid from '@mui/material/Grid';
import useLightbox from 'hooks/useLightbox';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { FreeMode, Navigation, Thumbs } from 'swiper/modules';
import { SwiperClass, SwiperSlide } from 'swiper/react';
import { Slide } from 'yet-another-react-lightbox';
import IconifyIcon from 'components/base/IconifyIcon';
import Image from 'components/base/Image';
import Lightbox from 'components/base/Lightbox';
import Swiper from 'components/base/Swiper';

// Product images come from the API as Cloudflare Image Resizing URLs at width=1400. Swap the
// width so the gallery downloads a size that fits the screen; non-resizing URLs pass through.
const withWidth = (url: string, width: number) =>
  url.includes('/cdn-cgi/image/') ? url.replace(/([/,])width=\d+/, `$1width=${width}`) : url;

const ProductGallery = ({ images, title = '' }: { images: string[]; title?: string }) => {
  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const hasMultipleImages = images.length > 1;
  const { openLightbox, ...lightboxProps } = useLightbox();

  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);

  // Only mount the photos for the current slide and its neighbours. Native lazy-loading doesn't
  // help inside the carousel: off-screen slides sit beside the viewport, so the browser fetched
  // every full-size photo up front and they competed with the first one.
  const [mountedSlides, setMountedSlides] = useState<Set<number>>(() => new Set([0]));
  // Thumbnails wait for the first photo too, so they don't split the bandwidth with it.
  const [firstPhotoLoaded, setFirstPhotoLoaded] = useState(false);
  useEffect(() => {
    setMountedSlides(new Set([0]));
    setFirstPhotoLoaded(false);
  }, [images]);
  const mountAround = useCallback(
    (index: number) => {
      const count = images.length;
      if (count === 0) return;
      const wanted = [index, (index + 1) % count, (index - 1 + count) % count];
      setMountedSlides((prev) =>
        wanted.every((i) => prev.has(i)) ? prev : new Set([...prev, ...wanted]),
      );
    },
    [images.length],
  );

  const { up } = useBreakpoints();
  const upLg = up('lg');
  const lightboxSlides: Slide[] = images.map((image) => ({ src: image, type: 'image' }));

  return (
    <>
      <Grid
        container
        sx={{
          flex: 1,
          gap: { xs: 2, md: 5, lg: 1 },
          justifyContent: 'center',
          flexWrap: { lg: 'nowrap' },
          height: 1,
          overflow: 'hidden',
        }}
      >
        <Grid
          sx={{
            order: { lg: 1 },
            height: { lg: 1 },
            maxWidth: { lg: 'fit-content' },
          }}
          size={{
            xs: 12,
            lg: 'grow',
          }}
        >
          <Stack
            sx={{
              gap: 3,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              height: { lg: 1 },
              width: 1,
              aspectRatio: { lg: 1 },
            }}
          >
            {hasMultipleImages && (
              <>
                <Button
                  ref={navigationPrevRef}
                  aria-label="Previous photo"
                  color="neutral"
                  shape="circle"
                  variant="soft"
                  sx={{
                    p: 1,
                    minWidth: 0,
                    flexShrink: 0,
                    position: 'absolute',
                    left: 24,
                    zIndex: 10,
                  }}
                >
                  <IconifyIcon
                    icon="material-symbols:chevron-left-rounded"
                    sx={(theme) => ({
                      fontSize: 20,
                      transform: theme.direction === 'rtl' ? 'rotate(180deg)' : 'none',
                    })}
                  />
                </Button>
                <Button
                  ref={navigationNextRef}
                  aria-label="Next photo"
                  color="neutral"
                  shape="circle"
                  variant="soft"
                  sx={{ p: 1, minWidth: 0, flexShrink: 0, position: 'absolute', zIndex: 10, right: 24 }}
                >
                  <IconifyIcon
                    icon="material-symbols:chevron-right-rounded"
                    sx={(theme) => ({
                      fontSize: 20,
                      transform: theme.direction === 'rtl' ? 'rotate(180deg)' : 'none',
                    })}
                  />
                </Button>
              </>
            )}
            <Swiper
              loop={hasMultipleImages}
              spaceBetween={10}
              thumbs={{
                swiper: hasMultipleImages && thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null,
              }}
              modules={[FreeMode, Navigation, Thumbs]}
              onSlideChange={(swiper) => {
                if (swiper.realIndex !== 0) mountAround(swiper.realIndex);
              }}
              navigation={hasMultipleImages ? {
                nextEl: navigationNextRef,
                prevEl: navigationPrevRef,
              } : false}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                height: 1,
                aspectRatio: 1,
                borderRadius: 6,
                maxWidth: { xs: 560, lg: 'unset' },
              }}
            >
              {images.map((image, index) => (
                <SwiperSlide key={`slide-${index}`}>
                  <Box
                    sx={{
                      height: 1,
                      aspectRatio: 1,
                      flexShrink: 0,
                      borderRadius: 6,
                      overflow: 'hidden',
                      bgcolor: 'background.elevation1',
                      position: 'relative',
                    }}
                  >
                    <Button
                      color="neutral"
                      shape="circle"
                      variant="soft"
                      aria-label="Open larger image"
                      onClick={() => openLightbox(index)}
                      sx={{
                        p: 1,
                        minWidth: 0,
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        zIndex: 11,
                      }}
                    >
                      <IconifyIcon icon="material-symbols:search-rounded" sx={{ fontSize: 20 }} />
                    </Button>
                    {mountedSlides.has(index) && <Image
                      src={withWidth(image, 1000)}
                      srcSet={`${withWidth(image, 640)} 640w, ${withWidth(image, 800)} 800w, ${withWidth(image, 1000)} 1000w, ${image} 1400w`}
                      sizes="(min-width: 1200px) 45vw, min(100vw, 560px)"
                      alt={title ? `${title} – photo ${index + 1}` : ''}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      decoding="async"
                      onLoad={
                        index === 0
                          ? () => {
                              setFirstPhotoLoaded(true);
                              mountAround(0);
                            }
                          : undefined
                      }
                      sx={{
                        height: 1,
                        width: 1,
                        objectFit: 'contain',
                        objectPosition: 'top',
                        display: 'block',
                        pointerEvents: 'none',
                      }}
                    />}
                  </Box>
                </SwiperSlide>
              ))}
            </Swiper>
          </Stack>
        </Grid>
        {hasMultipleImages && (
          <Grid
            size={{
              xs: 12,
              lg: 'auto',
            }}
          >
            <Swiper
              navigation={false}
              direction={upLg ? 'vertical' : 'horizontal'}
              onInit={setThumbsSwiper}
              spaceBetween={8}
              slidesPerView="auto"
              freeMode={true}
              watchSlidesProgress={true}
              modules={[FreeMode, Thumbs]}
              sx={{
                height: 1,
                flexShrink: 0,
                '& .swiper': {
                  height: 1,
                  '& .swiper-wrapper': {
                    justifyContent: { sm: 'center', lg: 'unset' },
                    '.swiper-slide': {
                      width: 'auto',
                      height: 'auto',
                    },
                  },
                },
              }}
            >
              {images.map((image, index) => (
                <SwiperSlide key={`slide-${index}`}>
                  <Box
                    sx={{
                      flexShrink: 0,
                      cursor: 'grab',
                      width: { xs: 80, md: 104, xl: 120 },
                      aspectRatio: 1,
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: 'background.elevation1',
                      border: '2px solid transparent',
                      '.swiper-slide-thumb-active &': {
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    {firstPhotoLoaded && <Image
                      src={withWidth(image, 240)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      sx={{ width: 1, height: 1, objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                    />}
                  </Box>
                </SwiperSlide>
              ))}
            </Swiper>
          </Grid>
        )}
      </Grid>
      <Lightbox
        slides={lightboxSlides}
        extension={['fullscreen', 'thumbnails', 'zoom']}
        {...lightboxProps}
      />
    </>
  );
};

export default ProductGallery;
