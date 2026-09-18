Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path "downloaded_logo.jpg"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Exact card bounds
$cropX = 15
$cropY = 13
$cropW = 662
$cropH = 673

function Generate-CleanLogo {
    param(
        [int]$size,
        [string]$outputPath
    )
    
    $dest = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Corner radius proportional to size
    $radius = [int]($size * 0.205)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc($rect.Right - $radius * 2, $rect.Y, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc($rect.Right - $radius * 2, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()

    $g.SetClip($path)
    $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $dest.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $dest.Dispose()
    Write-Output "Saved: $outputPath ($size x $size)"
}

Generate-CleanLogo -size 672 -outputPath "public/logo.png"
Generate-CleanLogo -size 512 -outputPath "public/icons/icon-512.png"
Generate-CleanLogo -size 192 -outputPath "public/icons/icon-192.png"
Generate-CleanLogo -size 180 -outputPath "public/icons/apple-icon.png"

$src.Dispose()
