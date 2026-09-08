Add-Type -AssemblyName System.Drawing

$projectRoot = $PSScriptRoot | Split-Path -Parent
$sourceLogo = Join-Path $projectRoot "public\logo.jpg"
$iconsDir = Join-Path $projectRoot "public\icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Generate-Icon {
    param(
        [string]$sourcePath,
        [string]$destinationPath,
        [int]$size
    )

    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Clean white background
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($brush, 0, 0, $size, $size)

    # Calculate centered aspect fit with 10% padding
    $pad = [int]($size * 0.05)
    $targetWidth = $size - ($pad * 2)
    $targetHeight = $size - ($pad * 2)

    $srcRatio = $srcImg.Width / $srcImg.Height
    $targetRatio = $targetWidth / $targetHeight

    if ($srcRatio -gt $targetRatio) {
        $destW = $targetWidth
        $destH = [int]($targetWidth / $srcRatio)
    } else {
        $destH = $targetHeight
        $destW = [int]($targetHeight * $srcRatio)
    }

    $destX = [int](($size - $destW) / 2)
    $destY = [int](($size - $destH) / 2)

    $g.DrawImage($srcImg, $destX, $destY, $destW, $destH)

    $bmp.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
    $brush.Dispose()

    Write-Output "Generado icono: $destinationPath ($size x $size)"
}

Generate-Icon -sourcePath $sourceLogo -destinationPath (Join-Path $iconsDir "icon-192x192.png") -size 192
Generate-Icon -sourcePath $sourceLogo -destinationPath (Join-Path $iconsDir "icon-512x512.png") -size 512
Generate-Icon -sourcePath $sourceLogo -destinationPath (Join-Path $iconsDir "apple-touch-icon.png") -size 180

Write-Output "¡Iconos PWA generados con éxito!"
